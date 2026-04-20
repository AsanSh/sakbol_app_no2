import type { LabAnalysisRow } from "@/types/family";
import type { HealthRecordAnalysisPayload } from "@/types/biomarker";

/** Дата для сортировки и отображения: из документа (если парсер положил в payload), иначе загрузка. */
export function effectiveAnalysisTimeMs(row: LabAnalysisRow): number {
  const raw = row.data;
  if (raw && typeof raw === "object") {
    const d = raw as Record<string, unknown> & Partial<HealthRecordAnalysisPayload>;
    const keys = ["analysisDate", "labDate", "documentDate", "parsedAt", "anonymizedAt"] as const;
    for (const k of keys) {
      const v = d[k];
      if (typeof v === "string" && v.trim()) {
        const t = Date.parse(v);
        if (!Number.isNaN(t)) return t;
      }
    }
  }
  return Date.parse(row.createdAt);
}

export function sortLabAnalysesNewestFirst(rows: LabAnalysisRow[]): LabAnalysisRow[] {
  return [...rows].sort((a, b) => effectiveAnalysisTimeMs(b) - effectiveAnalysisTimeMs(a));
}
