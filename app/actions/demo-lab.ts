"use server";

import { HealthRecordKind, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { FREE_MAX_ANALYSES, getFamilyTier } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { mockBiomarkers } from "@/lib/services/process-medical-document";
import type { HealthRecordAnalysisPayload } from "@/types/biomarker";

/** Запись анализа без файла — мок с гемоглобином (удобно для Vercel без persistent uploads). */
export async function seedDemoLabRecord(profileId: string) {
  const session = getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
  });
  if (!profile) {
    return { ok: false as const, error: "Profile not found." };
  }

  const tier = await getFamilyTier(session.familyId);
  const total = await prisma.healthRecord.count({
    where: {
      kind: HealthRecordKind.LAB_ANALYSIS,
      profile: { familyId: session.familyId },
    },
  });
  if (tier !== "PREMIUM" && total >= FREE_MAX_ANALYSES) {
    return { ok: false as const, error: "Premium required: free plan supports 3 analyses." };
  }

  const biomarkers = mockBiomarkers();
  const now = new Date().toISOString();
  const data: HealthRecordAnalysisPayload = {
    biomarkers,
    sourceFileId: "demo-local",
    sourceOriginalFileId: "demo-local",
    mimeType: "application/x-sakbol-demo",
    anonymizedAt: now,
    parsedAt: now,
    parser: "mock",
  };

  await prisma.healthRecord.create({
    data: {
      profileId,
      kind: HealthRecordKind.LAB_ANALYSIS,
      isPrivate: true,
      title: `Демо-анализ · ${new Date().toLocaleDateString("ru-RU")}`,
      data: data as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/");
  revalidatePath("/tests");
  revalidatePath("/profile");
  return { ok: true as const };
}
