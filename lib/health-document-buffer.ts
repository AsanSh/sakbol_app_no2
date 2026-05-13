import "server-only";

import { readHealthDocumentFromDisk } from "@/lib/health-documents-storage";

/**
 * Бинарник файла документа так же, как в GET /api/documents/[id]/file
 * (Blob в БД → диск → внешний URL).
 */
export async function loadHealthDocumentFileBuffer(input: {
  id: string;
  mimeType: string;
  fileUrl: string;
  fileData: Uint8Array | null;
}): Promise<Buffer | null> {
  if (input.fileData && input.fileData.byteLength > 0) {
    return Buffer.from(input.fileData);
  }
  if (input.fileUrl.startsWith("http://") || input.fileUrl.startsWith("https://")) {
    try {
      const res = await fetch(input.fileUrl, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch {
      return null;
    }
  }
  return readHealthDocumentFromDisk(input.id, input.mimeType);
}
