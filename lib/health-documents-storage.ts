import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import type { HealthDocumentCategory } from "@prisma/client";

export const HEALTH_DOCS_MAX_BYTES = 25 * 1024 * 1024;

export const HEALTH_DOC_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ROOT = path.join(os.tmpdir(), "sakbol-health-documents");

export function healthDocDiskPath(docId: string, mime: string): string {
  const ext = extForMime(mime);
  return path.join(ROOT, `${docId}.${ext}`);
}

export function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "application/pdf") return "pdf";
  if (m === "image/png") return "png";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/webp") return "webp";
  if (m === "application/msword") return "doc";
  if (m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "docx";
  return "bin";
}

export async function writeHealthDocumentToDisk(
  docId: string,
  buf: Buffer,
  mime: string,
): Promise<void> {
  await mkdir(ROOT, { recursive: true });
  const p = healthDocDiskPath(docId, mime);
  await writeFile(p, buf);
}

export async function readHealthDocumentFromDisk(docId: string, mime: string): Promise<Buffer | null> {
  try {
    return await readFile(healthDocDiskPath(docId, mime));
  } catch {
    return null;
  }
}

export function publicDocumentDownloadPath(docId: string): string {
  return `/api/documents/${docId}/file`;
}

/** Разбор category из multipart / Python-скрипта (enum-имя или короткий алиас). */
export function parseHealthDocumentCategory(raw: string | null | undefined): HealthDocumentCategory {
  const t = (raw ?? "").trim();
  if (!t) return "OTHER";
  const ascii = t.toUpperCase().replace(/\s+/g, "_");
  const aliases = new Map<string, HealthDocumentCategory>([
    ["ANALYSIS", "ANALYSIS"],
    ["LAB", "ANALYSIS"],
    ["DISCHARGE_SUMMARY", "DISCHARGE_SUMMARY"],
    ["EXCERPT", "DISCHARGE_SUMMARY"],
    ["PROTOCOL", "PROTOCOL"],
    ["PRESCRIPTION", "PRESCRIPTION"],
    ["CONTRACT", "CONTRACT"],
    ["OTHER", "OTHER"],
    ["АНАЛИЗ", "ANALYSIS"],
    ["ВЫПИСКА", "DISCHARGE_SUMMARY"],
    ["ПРОТОКОЛ", "PROTOCOL"],
    ["РЕЦЕПТ", "PRESCRIPTION"],
    ["ДОГОВОР", "CONTRACT"],
  ]);
  return aliases.get(t.toUpperCase()) ?? aliases.get(ascii) ?? "OTHER";
}
