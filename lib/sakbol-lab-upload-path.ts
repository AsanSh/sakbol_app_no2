import "server-only";

import path from "path";
import os from "os";

/** Должен совпадать с `app/actions/health-record.ts` — единый каталог для файла анализа до запасного Blob. */
export const LAB_UPLOAD_ROOT = path.join(os.tmpdir(), "sakbol-health-records");

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
