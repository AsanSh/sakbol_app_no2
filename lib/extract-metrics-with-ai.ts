import "server-only";

import type { ParsedBiomarker } from "@/types/biomarker";

export type MetricsAiInput = {
  biomarkers: ParsedBiomarker[];
  analysisDate?: string;
  labName?: string;
};

export type MetricsAiOutput = MetricsAiInput;

import { normalizeBiomarkerKey } from "@/lib/medical-logic";

/**
 * Подготовка данных для `HealthRecordMetrics.payload` после OCR.
 * Реализует нормализацию названий показателей для корректного построения графиков динамики.
 */
export async function extractMetricsWithAI(input: MetricsAiInput): Promise<MetricsAiOutput> {
  return {
    biomarkers: input.biomarkers.map((b) => {
      const normalizedName = normalizeBiomarkerKey(b.biomarker);

      // Логика нормализации единиц измерения (пример для Гемоглобина)
      let value = b.value;
      let unit = b.unit;

      if (normalizedName === "Гемоглобин") {
        // Если гемоглобин в г/дл (обычно < 20), переводим в г/л
        if (value < 25 && (unit.toLowerCase().includes("дл") || unit.toLowerCase().includes("dl"))) {
          value = value * 10;
          unit = "г/л";
        }
      }

      if (normalizedName === "Глюкоза") {
        // Перевод из мг/дл в ммоль/л
        if (value > 20 && (unit.toLowerCase().includes("mg") || unit.toLowerCase().includes("мг"))) {
          value = Number((value / 18.0182).toFixed(2));
          unit = "ммоль/л";
        }
      }

      return {
        biomarker: normalizedName || b.biomarker,
        value,
        unit,
        reference: b.reference,
      };
    }),
    ...(input.analysisDate ? { analysisDate: input.analysisDate } : {}),
    ...(input.labName ? { labName: input.labName } : {}),
  };
}
