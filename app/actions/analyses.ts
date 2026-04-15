"use server";

import { HealthRecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";
import { getSession } from "@/lib/session";
import type { LabAnalysisRow } from "@/types/family";

export async function listLabAnalysesForProfile(
  profileId: string,
): Promise<{ ok: true; analyses: LabAnalysisRow[] } | { ok: false; error: string }> {
  const session = getSession();
  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  const id = profileId.trim();
  if (!id) {
    return { ok: false, error: "profileId is required" };
  }

  try {
    const profile = await prisma.profile.findFirst({
      where: { id, familyId: session.familyId },
      select: { id: true },
    });

    if (!profile) {
      return { ok: false, error: "Profile not found" };
    }

    const analyses = await prisma.healthRecord.findMany({
      where: { profileId: id, kind: HealthRecordKind.LAB_ANALYSIS },
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

    return {
      ok: true,
      analyses: analyses.map((a) => ({
        id: a.id,
        title: a.title,
        data: resolveLabAnalysisPayload(a.data, a.metrics?.payload ?? null),
        isPrivate: a.isPrivate,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  } catch {
    return { ok: false, error: "Database unavailable" };
  }
}
