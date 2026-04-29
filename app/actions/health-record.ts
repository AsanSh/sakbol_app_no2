"use server";

import { createHash, randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { HealthRecordKind, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { FREE_MAX_ANALYSES, getFamilyTier } from "@/lib/premium";
import { checkProfileAccess } from "@/lib/profile-access-control";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { extForLabMime, LAB_UPLOAD_ROOT, labUploadDiskPath } from "@/lib/sakbol-lab-upload-path";
import { processMedicalDocument } from "@/lib/services/process-medical-document";

const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

type LabMeta = {
  sourceFileId?: string;
  mimeType?: string;
  contentSha256?: string;
  sourceBlobUrl?: string;
};

export async function deleteLabAnalysis(recordId: string) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const id = recordId.trim();
  if (!id) {
    return { ok: false as const, error: "Invalid id." };
  }

  const record = await prisma.healthRecord.findFirst({
    where: {
      id,
      kind: HealthRecordKind.LAB_ANALYSIS,
    },
    select: { id: true, profileId: true, data: true },
  });

  if (!record) {
    return { ok: false as const, error: "Запись не найдена." };
  }

  const access = await checkProfileAccess(session, record.profileId);
  if (!access.ok || !access.canWrite) {
    return { ok: false as const, error: "Нет прав удалять эту запись." };
  }

  const meta = record.data as LabMeta;
  const sourceFileId = typeof meta?.sourceFileId === "string" ? meta.sourceFileId.trim() : "";
  const mimeType = typeof meta?.mimeType === "string" ? meta.mimeType : "";
  if (meta?.sourceBlobUrl?.startsWith("https://")) {
    const { del } = await import("@vercel/blob");
    await del(meta.sourceBlobUrl).catch(() => {});
  } else if (
    sourceFileId &&
    !["demo-local", "seed"].includes(sourceFileId) &&
    ALLOWED.has(mimeType)
  ) {
    const diskPath = labUploadDiskPath(sourceFileId, mimeType);
    await unlink(diskPath).catch(() => {});
  }

  await prisma.healthRecord.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/tests");
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function uploadHealthRecord(formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const profileId = String(formData.get("profileId") ?? "").trim();
  const file = formData.get("file");

  if (!profileId || !(file instanceof File)) {
    return { ok: false as const, error: "Маалымат толук эмес." };
  }

  const access = await checkProfileAccess(session, profileId);
  if (!access.ok) {
    return { ok: false as const, error: "Профиль табылган жок." };
  }
  if (!access.canWrite) {
    return { ok: false as const, error: "Нет прав добавлять анализы в этот профиль." };
  }
  const tier = await getFamilyTier(session.familyId);
  const total = await prisma.healthRecord.count({
    where: {
      kind: HealthRecordKind.LAB_ANALYSIS,
      profile: { familyId: session.familyId },
    },
  });
  if (tier !== "PREMIUM" && total >= FREE_MAX_ANALYSES) {
    return {
      ok: false as const,
      error:
        "На бесплатном тарифе — не более 3 анализов на всю семью. Удалите лишние записи в списке (иконка корзины справа) или подключите Premium.",
    };
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return { ok: false as const, error: "Файл форматы колдоого алынбайт." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { ok: false as const, error: "Файл өлчөмү чектен ашып кетти." };
  }

  const contentSha256 = createHash("sha256").update(buf).digest("hex");
  const duplicate = await prisma.healthRecord.findFirst({
    where: {
      profileId,
      kind: HealthRecordKind.LAB_ANALYSIS,
      data: {
        path: ["contentSha256"],
        equals: contentSha256,
      },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false as const,
      error:
        "Этот файл уже загружен для выбранного профиля. Удалите старую запись (корзина на карточке) или выберите другой файл.",
    };
  }

  const fileId = randomUUID();

  await mkdir(LAB_UPLOAD_ROOT, { recursive: true });
  const diskPath = labUploadDiskPath(fileId, mime);

  async function tryBlobPut(): Promise<string | undefined> {
    if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) return undefined;
    try {
      const { put } = await import("@vercel/blob");
      const ext = extForLabMime(mime);
      const blob = await put(`lab-analysis/${fileId}.${ext}`, buf, {
        access: "public",
        contentType: mime,
      });
      return blob.url;
    } catch (e) {
      console.error("[uploadHealthRecord] blob put failed, keeping disk only", e);
      return undefined;
    }
  }

  let biomarkers: Awaited<ReturnType<typeof processMedicalDocument>>["biomarkers"];
  let parser: Awaited<ReturnType<typeof processMedicalDocument>>["parser"];
  let sourceBlobUrl: string | undefined;
  try {
    const [parsed, , blobUrl] = await Promise.all([
      processMedicalDocument(buf, mime),
      writeFile(diskPath, buf),
      tryBlobPut(),
    ]);
    biomarkers = parsed.biomarkers;
    parser = parsed.parser;
    sourceBlobUrl = blobUrl;
  } catch (e) {
    await unlink(diskPath).catch(() => {});
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Не удалось разобрать документ.",
    };
  }

  const now = new Date().toISOString();
  const meta = {
    sourceFileId: fileId,
    sourceOriginalFileId: fileId,
    mimeType: mime,
    contentSha256,
    anonymizedAt: now,
    parsedAt: now,
    parser,
    ...(sourceBlobUrl ? { sourceBlobUrl } : {}),
  };

  const record = await prisma.healthRecord.create({
    data: {
      profileId,
      kind: HealthRecordKind.LAB_ANALYSIS,
      isPrivate: true,
      title: `Анализ · ${new Date().toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })}`,
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
  revalidatePath("/tests");
  revalidatePath("/profile");
  return { ok: true as const, recordId: record.id, biomarkerCount: biomarkers.length };
}
