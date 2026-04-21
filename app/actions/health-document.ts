"use server";

import { unlink } from "fs/promises";
import { revalidatePath } from "next/cache";
import { createHealthDocumentForProfile } from "@/lib/health-document-create";
import { normalizeUploadedFilename } from "@/lib/filename-encoding";
import { healthDocDiskPath, parseHealthDocumentCategory } from "@/lib/health-documents-storage";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function uploadHealthDocument(formData: FormData) {
  const session = getSession();
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

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
    select: { id: true },
  });
  if (!profile) {
    return { ok: false as const, error: "Профиль не найден." };
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
  const title =
    titleRaw.trim() ||
    rawName ||
    `Документ ${new Date().toLocaleDateString("ru-RU")}`;

  const created = await createHealthDocumentForProfile({
    profileId,
    title,
    category,
    documentDate,
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
  const session = getSession();
  if (!session) {
    return { ok: false as const, error: "Требуется вход." };
  }

  const tid = id.trim();
  if (!tid) {
    return { ok: false as const, error: "Некорректный id." };
  }

  const doc = await prisma.healthDocument.findFirst({
    where: { id: tid, profile: { familyId: session.familyId } },
    select: { id: true, mimeType: true, fileUrl: true },
  });
  if (!doc) {
    return { ok: false as const, error: "Документ не найден." };
  }

  if (doc.fileUrl.startsWith("http://") || doc.fileUrl.startsWith("https://")) {
    const { del } = await import("@vercel/blob");
    await del(doc.fileUrl).catch(() => {});
  } else if (doc.mimeType) {
    await unlink(healthDocDiskPath(doc.id, doc.mimeType)).catch(() => {});
  }

  await prisma.healthDocument.delete({ where: { id: doc.id } });
  revalidatePath("/");
  revalidatePath("/tests");
  return { ok: true as const };
}
