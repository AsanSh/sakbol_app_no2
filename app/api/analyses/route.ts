import { NextRequest, NextResponse } from "next/server";
import { HealthRecordKind } from "@prisma/client";
import { checkProfileAccess } from "@/lib/profile-access-control";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";

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
    const access = await checkProfileAccess(session, profileId);
    if (!access.ok) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const analyses = await prisma.healthRecord.findMany({
      where: {
        profileId,
        OR: [
          { kind: HealthRecordKind.LAB_ANALYSIS },
          { metrics: { isNot: null } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        data: true,
        isPrivate: true,
        createdAt: true,
        metrics: { select: { payload: true } },
      },
    });

    const mapped = analyses
      .map((a) => ({
        id: a.id,
        title: a.title,
        data: resolveLabAnalysisPayload(a.data, a.metrics?.payload ?? null),
        isPrivate: a.isPrivate,
        createdAt: a.createdAt.toISOString(),
      }))
      .filter((a) => (a.data.biomarkers?.length ?? 0) > 0);

    return NextResponse.json({
      profileId,
      analyses: mapped,
    });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
