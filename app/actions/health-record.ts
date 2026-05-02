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
import { extractMetricsWithAI } from "@/lib/extract-metrics-with-ai";
import { processMedicalDocument } from "@/lib/services/process-medical-document";
import type { ParsedBiomarker } from "@/types/biomarker";

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_CONFIRM_PAYLOAD_CHARS = 512 * 1024;

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
  analysisDate?: string;
  labName?: string;
};

function normalizeIsoDateInput(raw: string): string | undefined {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString().slice(0, 10);
}

function buildLabRecordTitle(input: {
  title?: string;
  labName?: string;
  analysisDate?: string;
}): string {
  if (input.title?.trim()) return input.title.trim().slice(0, 200);
  const baseDate = input.analysisDate
    ? new Date(`${input.analysisDate}T12:00:00`)
    : new Date();
  const dateStr = !Number.isNaN(baseDate.getTime())
    ? baseDate.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : new Date().toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
  if (input.labName?.trim()) {
    return `Анализ · ${input.labName.trim().slice(0, 80)} · ${dateStr}`.slice(0, 200);
  }
  return `Анализ · ${dateStr}`;
}

type ConfirmedLabPayload = {
  biomarkers: ParsedBiomarker[];
  analysisDate?: string;
  labName?: string;
  title?: string;
  ocrParser?: "gemini" | "openai" | "mock";
};

function parseConfirmedLabPayload(raw: string): { ok: true; data: ConfirmedLabPayload } | { ok: false; error: string } {
  if (raw.length > MAX_CONFIRM_PAYLOAD_CHARS) {
    return { ok: false, error: "Слишком большой payload." };
  }
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Некорректный JSON подтверждения." };
  }
  if (!j || typeof j !== "object") return { ok: false, error: "Пустой payload." };
  const o = j as Record<string, unknown>;
  const biomarkersRaw = o.biomarkers;
  if (!Array.isArray(biomarkersRaw) || biomarkersRaw.length === 0) {
    return { ok: false, error: "Добавьте хотя бы один показатель." };
  }
  if (biomarkersRaw.length > 200) return { ok: false, error: "Слишком много строк (макс. 200)." };
  const biomarkers: ParsedBiomarker[] = [];
  for (const row of biomarkersRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const biomarker = String(r.biomarker ?? "").trim();
    const value = Number(r.value);
    if (!biomarker || biomarker.length > 200) continue;
    if (!Number.isFinite(value)) continue;
    biomarkers.push({
      biomarker,
      value,
      unit: String(r.unit ?? "").trim().slice(0, 64),
      reference: String(r.reference ?? "").trim().slice(0, 128),
    });
  }
  if (biomarkers.length === 0) return { ok: false, error: "Нет корректных показателей (название и число)." };

  const analysisDateRaw = o.analysisDate;
  const analysisDate =
    typeof analysisDateRaw === "string" && analysisDateRaw.trim()
      ? normalizeIsoDateInput(analysisDateRaw.trim())
      : undefined;

  const labNameRaw = o.labName;
  const labName =
    typeof labNameRaw === "string" && labNameRaw.trim()
      ? labNameRaw.trim().slice(0, 200)
      : undefined;

  const titleRaw = o.title;
  const title =
    typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim().slice(0, 200) : undefined;

  const pr = o.ocrParser;
  let ocrParser: "gemini" | "openai" | "mock" = "gemini";
  if (pr === "openai" || pr === "mock") ocrParser = pr;

  return {
    ok: true,
    data: {
      biomarkers,
      ...(analysisDate ? { analysisDate } : {}),
      ...(labName ? { labName } : {}),
      ...(title ? { title } : {}),
      ocrParser,
    },
  };
}

async function enforceLabUploadQuota(familyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tier = await getFamilyTier(familyId);
  const total = await prisma.healthRecord.count({
    where: {
      kind: HealthRecordKind.LAB_ANALYSIS,
      profile: { familyId },
    },
  });
  if (tier !== "PREMIUM" && total >= FREE_MAX_ANALYSES) {
    return {
      ok: false,
      error:
        "На бесплатном тарифе — не более 3 анализов на всю семью. Удалите лишние записи в списке (иконка корзины справа) или подключите Premium.",
    };
  }
  return { ok: true };
}

async function persistLabAnalysisUpload(args: {
  profileId: string;
  buf: Buffer;
  mime: string;
  biomarkers: ParsedBiomarker[];
  parser: "gemini" | "openai" | "mock";
  analysisDate?: string;
  labName?: string;
  titleOverride?: string;
}): Promise<{ ok: true; recordId: string; biomarkerCount: number } | { ok: false; error: string }> {
  const { profileId, buf, mime, biomarkers, parser, analysisDate, labName, titleOverride } = args;

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
      ok: false,
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
      console.error("[persistLabAnalysisUpload] blob put failed, keeping disk only", e);
      return undefined;
    }
  }

  let sourceBlobUrl: string | undefined;
  try {
    const [, blobUrl] = await Promise.all([writeFile(diskPath, buf), tryBlobPut()]);
    sourceBlobUrl = blobUrl;
  } catch (e) {
    await unlink(diskPath).catch(() => {});
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось сохранить файл.",
    };
  }

  const now = new Date().toISOString();
  const prepared = await extractMetricsWithAI({
    biomarkers,
    analysisDate,
    labName,
  });

  const meta: LabMeta & {
    sourceFileId: string;
    sourceOriginalFileId: string;
    mimeType: string;
    contentSha256: string;
    anonymizedAt: string;
    parsedAt: string;
    parser: "gemini" | "openai" | "mock";
  } = {
    sourceFileId: fileId,
    sourceOriginalFileId: fileId,
    mimeType: mime,
    contentSha256,
    anonymizedAt: now,
    parsedAt: now,
    parser,
    ...(sourceBlobUrl ? { sourceBlobUrl } : {}),
    ...(prepared.analysisDate ? { analysisDate: prepared.analysisDate } : {}),
    ...(prepared.labName ? { labName: prepared.labName } : {}),
  };

  const metricsPayload: Record<string, unknown> = { biomarkers: prepared.biomarkers };
  if (prepared.analysisDate) metricsPayload.analysisDate = prepared.analysisDate;
  if (prepared.labName) metricsPayload.labName = prepared.labName;

  try {
    const record = await prisma.healthRecord.create({
      data: {
        profileId,
        kind: HealthRecordKind.LAB_ANALYSIS,
        isPrivate: true,
        title: buildLabRecordTitle({
          title: titleOverride,
          labName: prepared.labName ?? labName,
          analysisDate: prepared.analysisDate ?? analysisDate,
        }),
        data: meta as unknown as Prisma.InputJsonValue,
        metrics: {
          create: {
            payload: metricsPayload as Prisma.InputJsonValue,
          },
        },
      },
      select: { id: true },
    });

    revalidatePath("/");
    revalidatePath("/tests");
    revalidatePath("/profile");
    return { ok: true, recordId: record.id, biomarkerCount: prepared.biomarkers.length };
  } catch (e) {
    await unlink(diskPath).catch(() => {});
    if (sourceBlobUrl?.startsWith("https://")) {
      const { del } = await import("@vercel/blob");
      await del(sourceBlobUrl).catch(() => {});
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось создать запись.",
    };
  }
}

/** Smart Upload: OCR без сохранения файла и без списания лимита. */
export async function previewLabOcr(formData: FormData) {
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

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return { ok: false as const, error: "Файл форматы колдоого алынбайт." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { ok: false as const, error: "Файл өлчөмү чектен ашып кетти." };
  }

  try {
    const parsed = await processMedicalDocument(buf, mime);
    return {
      ok: true as const,
      draft: {
        biomarkers: parsed.biomarkers,
        analysisDate: parsed.analysisDate,
        labName: parsed.labName,
        ocrParser: parsed.parser,
      },
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Не удалось разобрать документ.",
    };
  }
}

/** После подтверждения формы: файл в хранилище + HealthRecord (динамика из metrics). */
export async function commitConfirmedLabUpload(formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const profileId = String(formData.get("profileId") ?? "").trim();
  const file = formData.get("file");
  const payloadRaw = String(formData.get("payload") ?? "").trim();

  if (!profileId || !(file instanceof File) || !payloadRaw) {
    return { ok: false as const, error: "Маалымат толук эмес (файл и JSON)." };
  }

  const access = await checkProfileAccess(session, profileId);
  if (!access.ok) {
    return { ok: false as const, error: "Профиль табылган жок." };
  }
  if (!access.canWrite) {
    return { ok: false as const, error: "Нет прав добавлять анализы в этот профиль." };
  }

  const quota = await enforceLabUploadQuota(session.familyId);
  if (!quota.ok) return quota;

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return { ok: false as const, error: "Файл форматы колдоого алынбайт." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { ok: false as const, error: "Файл өлчөмү чектен ашып кетти." };
  }

  const parsedPayload = parseConfirmedLabPayload(payloadRaw);
  if (!parsedPayload.ok) {
    return { ok: false as const, error: parsedPayload.error };
  }
  const { biomarkers, analysisDate, labName, title, ocrParser } = parsedPayload.data;

  return persistLabAnalysisUpload({
    profileId,
    buf,
    mime,
    biomarkers,
    parser: ocrParser ?? "gemini",
    analysisDate,
    labName,
    titleOverride: title,
  });
}

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

/** Прямая загрузка без шага подтверждения (совместимость). Smart Upload использует previewLabOcr + commitConfirmedLabUpload. */
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

  const quota = await enforceLabUploadQuota(session.familyId);
  if (!quota.ok) return quota;

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return { ok: false as const, error: "Файл форматы колдоого алынбайт." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { ok: false as const, error: "Файл өлчөмү чектен ашып кетти." };
  }

  let parsed: Awaited<ReturnType<typeof processMedicalDocument>>;
  try {
    parsed = await processMedicalDocument(buf, mime);
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Не удалось разобрать документ.",
    };
  }

  const saved = await persistLabAnalysisUpload({
    profileId,
    buf,
    mime,
    biomarkers: parsed.biomarkers,
    parser: parsed.parser,
    analysisDate: parsed.analysisDate,
    labName: parsed.labName,
  });

  if (!saved.ok) return saved;
  return {
    ok: true as const,
    recordId: saved.recordId,
    biomarkerCount: saved.biomarkerCount,
  };
}
