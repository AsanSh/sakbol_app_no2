import "server-only";

import { HEALTH_DOCS_MAX_BYTES, HEALTH_DOC_ALLOWED_MIME } from "@/lib/health-documents-storage";

export function isHealthDocumentTextExtractable(mime: string): boolean {
  if (mime === "application/pdf") return true;
  if (mime.startsWith("image/")) return true;
  return false;
}

/**
 * Текст для эвристик: PDF через pdf-parse, изображения — OCR (rus+eng).
 * Для doc/docx возвращает пустую строку (без тяжёлых парсеров).
 */
export async function extractPlainTextFromHealthDocumentBuffer(
  buffer: Buffer,
  mime: string,
): Promise<string> {
  if (buffer.length === 0 || buffer.length > HEALTH_DOCS_MAX_BYTES) return "";
  if (!HEALTH_DOC_ALLOWED_MIME.has(mime)) return "";

  if (mime === "application/pdf") {
    try {
      const mod = await import("pdf-parse");
      const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text?: string }> })
        .default;
      const data = await pdfParse(buffer);
      return String(data?.text ?? "")
        .replace(/\0/g, "")
        .trim()
        .slice(0, 50_000);
    } catch {
      return "";
    }
  }

  if (mime.startsWith("image/")) {
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("rus+eng");
      const {
        data: { text },
      } = await worker.recognize(buffer);
      await worker.terminate();
      return String(text ?? "")
        .trim()
        .slice(0, 50_000);
    } catch {
      return "";
    }
  }

  return "";
}
