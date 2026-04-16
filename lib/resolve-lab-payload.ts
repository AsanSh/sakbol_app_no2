import type { HealthRecordAnalysisPayload, ParsedBiomarker } from "@/types/biomarker";

/**
 * Объединяет метаданные записи и клинический payload из отдельной таблицы metrics.
 * Обратная совместимость: старые строки держат всё в `data`.
 */
export function resolveLabAnalysisPayload(
  data: unknown,
  metricsPayload: unknown | null | undefined,
): HealthRecordAnalysisPayload {
  const d = (data && typeof data === "object" ? data : {}) as Partial<HealthRecordAnalysisPayload>;
  const rawBiomarkers = ((): ParsedBiomarker[] => {
    if (metricsPayload && typeof metricsPayload === "object") {
      const m = metricsPayload as { biomarkers?: unknown };
      if (Array.isArray(m.biomarkers)) return m.biomarkers as ParsedBiomarker[];
    }
    if (Array.isArray(d.biomarkers)) return d.biomarkers;
    return [];
  })();

  const parserRaw = d.parser;
  const parser: HealthRecordAnalysisPayload["parser"] =
    parserRaw === "gemini" ||
    parserRaw === "openai" ||
    parserRaw === "mock" ||
    parserRaw === "seed"
      ? parserRaw
      : "mock";

  return {
    biomarkers: rawBiomarkers,
    sourceFileId: typeof d.sourceFileId === "string" ? d.sourceFileId : "legacy",
    sourceOriginalFileId:
      typeof d.sourceOriginalFileId === "string" ? d.sourceOriginalFileId : undefined,
    mimeType: typeof d.mimeType === "string" ? d.mimeType : "application/octet-stream",
    anonymizedAt: typeof d.anonymizedAt === "string" ? d.anonymizedAt : "",
    parsedAt: typeof d.parsedAt === "string" ? d.parsedAt : "",
    parser,
  };
}
