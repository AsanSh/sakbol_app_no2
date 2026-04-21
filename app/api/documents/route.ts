import { NextResponse } from "next/server";
import type { HealthDocumentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CATEGORIES = new Set<string>([
  "ANALYSIS",
  "DISCHARGE_SUMMARY",
  "PROTOCOL",
  "PRESCRIPTION",
  "CONTRACT",
  "OTHER",
]);

/** Список документов семьи (все профили familyId). */
export async function GET(req: Request) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cat = searchParams.get("category");
  const profileIdFilter = searchParams.get("profileId")?.trim();
  const cursor = searchParams.get("cursor")?.trim();
  const takeRaw = Number.parseInt(searchParams.get("take") ?? "20", 10);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 50) : 20;
  const category =
    cat && CATEGORIES.has(cat) ? (cat as HealthDocumentCategory) : undefined;

  // Проверяем гостевой доступ: если profileId задан и это не наш профиль, ищем ProfileAccess
  let canAccessProfileId = true;
  if (profileIdFilter) {
    const ownProfile = await prisma.profile.findFirst({
      where: { id: profileIdFilter, familyId: session.familyId },
      select: { id: true },
    });
    if (!ownProfile) {
      const guestAccess = await prisma.profileAccess.findFirst({
        where: {
          sourceProfileId: profileIdFilter,
          granteeProfileId: session.profileId,
          acceptedAt: { not: null },
          revokedAt: null,
        },
        select: { id: true },
      });
      canAccessProfileId = !!guestAccess;
    }
  }

  if (!canAccessProfileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const docs = await prisma.healthDocument.findMany({
      where: {
        ...(profileIdFilter
          ? { profileId: profileIdFilter }
          : { profile: { familyId: session.familyId } }),
        ...(category ? { category } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
      select: {
        id: true,
        title: true,
        fileUrl: true,
        category: true,
        documentDate: true,
        createdAt: true,
        mimeType: true,
      },
    });
    const hasMore = docs.length > take;
    const documents = hasMore ? docs.slice(0, take) : docs;
    const nextCursor = hasMore ? documents[documents.length - 1]?.id ?? null : null;
    return NextResponse.json({ documents, hasMore, nextCursor });
  } catch (e) {
    console.error("documents list", e);
    return NextResponse.json({ error: "Server error" }, { status: 503 });
  }
}
