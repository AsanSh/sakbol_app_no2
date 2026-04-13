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
  parser: "openai" | "mock";
};
