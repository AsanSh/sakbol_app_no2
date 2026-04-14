import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const family = await prisma.family.findUnique({
      where: { id: session.familyId },
      include: {
        plan: { select: { tier: true } },
        profiles: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            familyRole: true,
            isManaged: true,
            telegramUserId: true,
            managedRole: true,
            dateOfBirth: true,
            biologicalSex: true,
          },
        },
      },
    });

    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...family,
      tier: family.plan?.tier ?? "FREE",
    });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and Postgres." },
      { status: 503 },
    );
  }
}
