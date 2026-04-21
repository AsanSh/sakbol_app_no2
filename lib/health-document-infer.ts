import "server-only";

import type { HealthDocumentCategory } from "@prisma/client";
import {
  extractMetadataFromPlainText,
  parseYmdToUtcNoon,
} from "@/lib/health-document-metadata";
import {
  extractPlainTextFromHealthDocumentBuffer,
  isHealthDocumentTextExtractable,
} from "@/lib/health-document-text-extract";

export type InferHealthDocumentResult = {
  title: string;
  category: HealthDocumentCategory;
  documentDate: Date | null;
};

/**
 * Заполняет название, категорию и дату по содержимому файла, не перетирая явно переданные поля.
 */
export async function inferHealthDocumentFields(input: {
  buffer: Buffer;
  mime: string;
  fileBaseName: string;
  /** Уже задано пользователем / скриптом */
  title?: string;
  category?: HealthDocumentCategory;
  /** Если передана валидная Date — не перезаписываем; иначе пробуем извлечь из файла. */
  documentDate?: Date | null;
}): Promise<InferHealthDocumentResult> {
  let title = input.title?.trim() ?? "";
  let category: HealthDocumentCategory = input.category ?? "OTHER";

  const dateLocked =
    input.documentDate instanceof Date && !Number.isNaN(input.documentDate.getTime());
  let documentDate: Date | null = dateLocked ? input.documentDate! : null;

  const needTitle = !title;
  const needCategory = category === "OTHER";
  const needDate = !dateLocked;

  if ((needTitle || needCategory || needDate) && isHealthDocumentTextExtractable(input.mime)) {
    const plain = await extractPlainTextFromHealthDocumentBuffer(input.buffer, input.mime);
    if (plain.length > 0) {
      const meta = extractMetadataFromPlainText(plain, { fileBaseName: input.fileBaseName });
      if (needTitle) title = meta.title;
      if (needCategory && meta.category !== "OTHER") category = meta.category;
      if (needDate && meta.documentDateISO) {
        const d = parseYmdToUtcNoon(meta.documentDateISO);
        if (d) documentDate = d;
      }
    }
  }

  if (!title) {
    title =
      input.fileBaseName.replace(/\.[a-z0-9]+$/i, "").trim() ||
      `Документ ${new Date().toLocaleDateString("ru-RU")}`;
  }

  return { title: title.slice(0, 500), category, documentDate };
}
