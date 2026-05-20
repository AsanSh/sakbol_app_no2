"use server";

import { unlink } from "fs/promises";
import { revalidatePath } from "next/cache";
import { createHealthDocumentForProfile } from "@/lib/health-document-create";
import { inferHealthDocumentFields } from "@/lib/health-document-infer";
import { isHealthDocumentTextExtractable } from "@/lib/health-document-text-extract";
import { normalizeUploadedFilename } from "@/lib/filename-encoding";
import {
  healthDocDiskPath,
  parseHealthDocumentCategory,
  readHealthDocumentFromDisk,
} from "@/lib/health-documents-storage";
import { checkProfileAccess } from "@/lib/profile-access-control";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  analyzeMedicalDocumentBuffer,
  type MedicalDocumentAnalysis,
} from "@/lib/services/analyze-medical-document";

export async function uploadHealthDocument(formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Требуется вход." };
  }

  const profileId = String(formData.get("profileId") ?? "").trim();
  const file = formData.get("file");
  const category = parseHealthDocumentCategory(String(formData.get("category") ?? "OTHER"));
  const documentDateRaw = String(formData.get("documentDate") ?? "").trim();
  const titleRaw = String(formData.get("title") ?? "").trim();

  if (!profileId || !(file instanceof File)) {
    return { ok: false as const, error: "Укажите профиль и файл." };
  }

  const access = await checkProfileAccess(session, profileId);
  if (!access.ok) {
    return { ok: false as const, error: "Профиль не найден." };
  }
  if (!access.canWrite) {
    return { ok: false as const, error: "Нет прав добавлять документы в этот профиль." };
  }

  let documentDate: Date | null = null;
  if (documentDateRaw) {
    const d = new Date(documentDateRaw);
    if (!Number.isNaN(d.getTime())) documentDate = d;
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const rawName =
    file.name && file.name !== "blob" ? normalizeUploadedFilename(file.name) : "";

  const explicitTitle = titleRaw.trim();
  const explicitDateStr = documentDateRaw.trim();

  let title =
    explicitTitle ||
    rawName ||
    `Документ ${new Date().toLocaleDateString("ru-RU")}`;
  let finalCategory = category;
  let finalDocumentDate = documentDate;

  if (
    (!explicitTitle || !explicitDateStr || finalCategory === "OTHER") &&
    isHealthDocumentTextExtractable(mime)
  ) {
    const inferred = await inferHealthDocumentFields({
      buffer: buf,
      mime,
      fileBaseName: rawName || "document",
      title: explicitTitle || undefined,
      category: finalCategory,
      documentDate: finalDocumentDate ?? undefined,
    });
    if (!explicitTitle) title = inferred.title;
    if (!explicitDateStr) finalDocumentDate = inferred.documentDate;
    if (finalCategory === "OTHER" && inferred.category !== "OTHER") {
      finalCategory = inferred.category;
    }
  }

  const created = await createHealthDocumentForProfile({
    profileId,
    title,
    category: finalCategory,
    documentDate: finalDocumentDate,
    buffer: buf,
    mime,
  });

  if (!created.ok) {
    return { ok: false as const, error: created.error };
  }

  revalidatePath("/");
  revalidatePath("/tests");
  return { ok: true as const };
}

export async function deleteHealthDocument(id: string) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Требуется вход." };
  }

  const tid = id.trim();
  if (!tid) {
    return { ok: false as const, error: "Некорректный id." };
  }

  const doc = await prisma.healthDocument.findFirst({
    where: { id: tid },
    select: { id: true, profileId: true, mimeType: true, fileUrl: true },
  });
  if (!doc) {
    return { ok: false as const, error: "Документ не найден." };
  }
  const access = await checkProfileAccess(session, doc.profileId);
  if (!access.ok || !access.canWrite) {
    return { ok: false as const, error: "Нет прав удалять этот документ." };
  }

  if (doc.mimeType && !doc.fileUrl.startsWith("http://") && !doc.fileUrl.startsWith("https://")) {
    await unlink(healthDocDiskPath(doc.id, doc.mimeType)).catch(() => {});
  }

  await prisma.healthDocument.delete({ where: { id: doc.id } });
  revalidatePath("/");
  revalidatePath("/tests");
  return { ok: true as const };
}

export async function updateHealthDocumentMeta(input: {
  id: string;
  title: string;
  category: string;
  documentDate: string | null;
}) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Требуется вход." };
  }

  const id = String(input.id ?? "").trim();
  const title = String(input.title ?? "").trim();
  const category = parseHealthDocumentCategory(String(input.category ?? "OTHER"));
  const dateRaw = String(input.documentDate ?? "").trim();

  if (!id) {
    return { ok: false as const, error: "Некорректный id." };
  }
  if (!title) {
    return { ok: false as const, error: "Укажите название документа." };
  }
  if (title.length > 180) {
    return { ok: false as const, error: "Название слишком длинное." };
  }

  let documentDate: Date | null = null;
  if (dateRaw) {
    const parsed = new Date(dateRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false as const, error: "Некорректная дата документа." };
    }
    documentDate = parsed;
  }

  const doc = await prisma.healthDocument.findFirst({
    where: { id },
    select: { id: true, profileId: true },
  });
  if (!doc) {
    return { ok: false as const, error: "Документ не найден." };
  }
  const access = await checkProfileAccess(session, doc.profileId);
  if (!access.ok || !access.canWrite) {
    return { ok: false as const, error: "Нет прав редактировать этот документ." };
  }

  await prisma.healthDocument.update({
    where: { id: doc.id },
    data: {
      title,
      category,
      documentDate,
    },
  });

  revalidatePath("/");
  revalidatePath("/tests");
  return { ok: true as const };
}

async function loadHealthDocumentBuffer(
  doc: { id: string; mimeType: string | null; fileUrl: string; fileData: Buffer | null },
): Promise<Buffer | null> {
  if (doc.fileData && doc.fileData.byteLength > 0) {
    return Buffer.from(doc.fileData);
  }
  if (doc.fileUrl.startsWith("http://") || doc.fileUrl.startsWith("https://")) {
    try {
      const res = await fetch(doc.fileUrl, { cache: "no-store" });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch {
      return null;
    }
  }
  if (!doc.mimeType) return null;
  return readHealthDocumentFromDisk(doc.id, doc.mimeType);
}

export type AnalyzeHealthDocumentActionResult =
  | {
      ok: true;
      analysis: MedicalDocumentAnalysis;
      modelId: string;
      disclaimer: string;
    }
  | { ok: false; error: string };

/**
 * ИИ-разбор уже загруженного HealthDocument: PDF/изображение → структурированный
 * JSON (тип документа, краткое содержание, диагнозы, назначения, рекомендации,
 * к каким врачам идти, что спросить). Bedrock Nova Pro с fallback на OpenRouter.
 */
export async function analyzeHealthDocumentAi(
  documentId: string,
): Promise<AnalyzeHealthDocumentActionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Требуется вход." };
  }

  const id = String(documentId ?? "").trim();
  if (!id) {
    return { ok: false, error: "Некорректный id документа." };
  }

  const doc = await prisma.healthDocument.findFirst({
    where: { id },
    select: {
      id: true,
      profileId: true,
      mimeType: true,
      fileUrl: true,
      fileData: true,
      title: true,
    },
  });
  if (!doc || !doc.mimeType) {
    return { ok: false, error: "Документ не найден." };
  }

  const access = await checkProfileAccess(session, doc.profileId);
  if (!access.ok) {
    return { ok: false, error: "Нет доступа к этому документу." };
  }

  const buf = await loadHealthDocumentBuffer(doc);
  if (!buf) {
    return { ok: false, error: "Файл документа недоступен на сервере." };
  }

  const result = await analyzeMedicalDocumentBuffer(buf, doc.mimeType);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    analysis: result.analysis,
    modelId: result.modelId,
    disclaimer: result.disclaimer,
  };
}
