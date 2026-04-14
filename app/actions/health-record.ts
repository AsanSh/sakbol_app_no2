"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { HealthRecordKind, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { FREE_MAX_ANALYSES, getFamilyTier } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { processMedicalDocument } from "@/lib/services/process-medical-document";

const MAX_BYTES = 12 * 1024 * 1024;
const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "health-records");

const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

function extForMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export async function uploadHealthRecord(formData: FormData) {
  const session = getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const profileId = String(formData.get("profileId") ?? "").trim();
  const file = formData.get("file");

  if (!profileId || !(file instanceof File)) {
    return { ok: false as const, error: "Маалымат толук эмес." };
  }

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
  });
  if (!profile) {
    return { ok: false as const, error: "Профиль табылган жок." };
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

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return { ok: false as const, error: "Файл форматы колдоого алынбайт." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { ok: false as const, error: "Файл өлчөмү чектен ашып кетти." };
  }

  const fileId = randomUUID();
  const safeName = `${fileId}.${extForMime(mime)}`;

  await mkdir(UPLOAD_ROOT, { recursive: true });
  const diskPath = path.join(UPLOAD_ROOT, safeName);
  await writeFile(diskPath, buf);

  const { biomarkers, parser } = await processMedicalDocument(buf, mime);

  const now = new Date().toISOString();
  const meta = {
    sourceFileId: fileId,
    sourceOriginalFileId: fileId,
    mimeType: mime,
    anonymizedAt: now,
    parsedAt: now,
    parser,
  };

  const record = await prisma.healthRecord.create({
    data: {
      profileId,
      kind: HealthRecordKind.LAB_ANALYSIS,
      isPrivate: true,
      title: `Анализ · ${new Date().toLocaleDateString("ky-KG")}`,
      data: meta as Prisma.InputJsonValue,
      metrics: {
        create: {
          payload: { biomarkers } as Prisma.InputJsonValue,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/");
  return { ok: true as const, recordId: record.id, biomarkerCount: biomarkers.length };
}
