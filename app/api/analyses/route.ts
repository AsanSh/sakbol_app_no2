import { NextRequest, NextResponse } from "next/server";
import { HealthRecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profileId = req.nextUrl.searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  try {
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, familyId: session.familyId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const analyses = await prisma.healthRecord.findMany({
      where: { profileId, kind: HealthRecordKind.LAB_ANALYSIS },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        data: true,
        isPrivate: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      profileId,
      analyses: analyses.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
