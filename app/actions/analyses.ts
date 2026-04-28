"use server";

import { HealthRecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkProfileAccess } from "@/lib/profile-access-control";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";
import { getSession } from "@/lib/session";
import type { LabAnalysisRow } from "@/types/family";
import { sortLabAnalysesNewestFirst } from "@/lib/lab-analysis-dates";

export async function listLabAnalysesForProfile(
  profileId: string,
): Promise<{ ok: true; analyses: LabAnalysisRow[] } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  const id = profileId.trim();
  if (!id) {
    return { ok: false, error: "profileId is required" };
  }

  try {
    const access = await checkProfileAccess(session, id);
    if (!access.ok) {
      return { ok: false, error: "Profile not found" };
    }

    const analyses = await prisma.healthRecord.findMany({
      where: {
        profileId: id,
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

    const mapped: LabAnalysisRow[] = analyses
      .map((a) => ({
        id: a.id,
        title: a.title,
        data: resolveLabAnalysisPayload(a.data, a.metrics?.payload ?? null),
        isPrivate: a.isPrivate,
        createdAt: a.createdAt.toISOString(),
      }))
      .filter((a) => (a.data.biomarkers?.length ?? 0) > 0);

    return {
      ok: true,
      analyses: sortLabAnalysesNewestFirst(mapped),
    };
  } catch {
    return { ok: false, error: "Database unavailable" };
  }
}
