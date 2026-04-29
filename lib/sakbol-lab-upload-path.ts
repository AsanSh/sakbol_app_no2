import "server-only";

import path from "path";
import os from "os";

function sakbolDataRoot(): string {
  const raw = process.env.SAKBOL_DATA_DIR?.trim();
  if (raw) return path.resolve(raw);
  return path.join(os.tmpdir(), "sakbol");
}

/** Единый каталог для файла анализа на диске (персистентный при SAKBOL_DATA_DIR + volume). */
export const LAB_UPLOAD_ROOT = path.join(sakbolDataRoot(), "lab-uploads");

export function extForLabMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export function labUploadDiskPath(fileId: string, mime: string): string {
  return path.join(LAB_UPLOAD_ROOT, `${fileId}.${extForLabMime(mime)}`);
}
