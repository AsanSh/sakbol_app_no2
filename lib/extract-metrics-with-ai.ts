import "server-only";

import type { ParsedBiomarker } from "@/types/biomarker";

export type MetricsAiInput = {
  biomarkers: ParsedBiomarker[];
  analysisDate?: string;
  labName?: string;
};

export type MetricsAiOutput = MetricsAiInput;

/**
 * Подготовка данных для `HealthRecordMetrics.payload` после OCR.
 * Сейчас — прозрачная заглушка (данные уже в формате `{ biomarker, value, unit, reference }`).
 * TODO: при необходимости — второй проход LLM (нормализация названий, единиц, выбросы).
 */
export async function extractMetricsWithAI(input: MetricsAiInput): Promise<MetricsAiOutput> {
  return {
    biomarkers: input.biomarkers.map((b) => ({
      biomarker: b.biomarker,
      value: b.value,
      unit: b.unit,
      reference: b.reference,
    })),
    ...(input.analysisDate ? { analysisDate: input.analysisDate } : {}),
    ...(input.labName ? { labName: input.labName } : {}),
  };
}
