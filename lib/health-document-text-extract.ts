import "server-only";

import { HEALTH_DOCS_MAX_BYTES, HEALTH_DOC_ALLOWED_MIME } from "@/lib/health-documents-storage";
import { extractTextFromScannedPdfPages } from "@/lib/pdf-poppler-ocr";

/** Меньше этого — считаем PDF «без текстового слоя» и пробуем Poppler+Tesseract (если есть pdftoppm). */
const PDF_TEXT_MIN_BEFORE_OCR = 64;

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
    let text = "";
    try {
      const mod = await import("pdf-parse");
      const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text?: string }> })
        .default;
      const data = await pdfParse(buffer);
      text = String(data?.text ?? "")
        .replace(/\0/g, "")
        .trim()
        .slice(0, 50_000);
    } catch {
      text = "";
    }
    if (text.length < PDF_TEXT_MIN_BEFORE_OCR) {
      const ocr = await extractTextFromScannedPdfPages(buffer, { maxPages: 4, scaleTo: 2000 });
      if (ocr.length > text.length) {
        text = ocr.slice(0, 50_000);
      }
    }
    return text;
  }

  if (mime.startsWith("image/")) {
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("rus+eng");
      await worker.setParameters({
        preserve_interword_spaces: "1",
      });
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
