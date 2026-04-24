/** One line from a lab report after OCR/LLM (no patient PII). */
export type ParsedBiomarker = {
  biomarker: string;
  value: number;
  unit: string;
  reference: string;
};

export type HealthRecordAnalysisPayload = {
  biomarkers: ParsedBiomarker[];
  sourceFileId: string;
  sourceOriginalFileId?: string;
  mimeType: string;
  anonymizedAt: string;
  parsedAt: string;
  parser: "gemini" | "openai" | "mock" | "seed";
  /** ISO: дата из бланка (после OCR), иначе сортировка по uploadedAt */
  analysisDate?: string;
  labDate?: string;
  documentDate?: string;
  /** Название лаборатории / клиники, если извлечено */
  labName?: string;
  /** Публичный URL в Vercel Blob (если загрузка шла с BLOB_READ_WRITE_TOKEN) — шаринг файла работает на serverless. */
  sourceBlobUrl?: string;
};
