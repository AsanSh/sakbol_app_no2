import {
  AGE_BAND_MONTHS,
  LAB_NORMS,
  type AgeBand,
  type LabNormEntry,
} from "@/constants/labNorms";
import type { HealthRecordAnalysisPayload, ParsedBiomarker } from "@/types/biomarker";
import type { LabAnalysisRow } from "@/types/family";

export type MedicalStatus = "normal" | "warning" | "critical";

const CRITICAL_SOFT = "#F28B82";

export function getStatusColorHex(status: MedicalStatus): string {
  if (status === "normal") return "#00695C";
  if (status === "warning") return "#FFC107";
  return CRITICAL_SOFT;
}

/** Туулган күн жок болсо — чоңдорго жакын (30 жаш). */
export function ageInMonthsFromDob(dob: string | Date | null | undefined): number {
  if (dob == null) return 30 * 12;
  const birth = typeof dob === "string" ? new Date(dob) : dob;
  if (Number.isNaN(birth.getTime())) return 30 * 12;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12;
  months += now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

export function ageBandFromMonths(months: number): AgeBand {
  if (months <= AGE_BAND_MONTHS.infantMax) return "infant";
  if (months <= AGE_BAND_MONTHS.childMax) return "child";
  return "adult";
}

const ALIASES: Record<string, string> = {
  гемоглобин: "Гемоглобин",
  hemoglobin: "Гемоглобин",
  глюкоза: "Глюкоза",
  glucose: "Глюкоза",
  ферритин: "Ферритин",
  ferritin: "Ферритин",
  ттг: "ТТГ",
  tsh: "ТТГ",
  "витамин d": "Витамин D",
  "vitamin d": "Витамин D",
  лейкоциттер: "Лейкоциттер",
  тромбоциттер: "Тромбоциттер",
  креатинин: "Креатинин",
  creatinine: "Креатинин",
  холестерин: "Холестерин",
  cholesterol: "Холестерин",
  "общий холестерин": "Холестерин",
  ldl: "ЛПНП",
  лпнп: "ЛПНП",
  лпвп: "ЛПВП",
  hdl: "ЛПВП",
  "холестерин лпвп": "ЛПВП",
};

export function normalizeBiomarkerKey(raw: string): string | null {
  const t = raw.trim();
  if (LAB_NORMS[t]) return t;
  const lower = t.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  for (const key of Object.keys(LAB_NORMS)) {
    if (key.toLowerCase() === lower) return key;
  }
  return null;
}

export function getNormForBiomarker(
  biomarkerKey: string,
  ageMonths: number,
): LabNormEntry | null {
  const band = ageBandFromMonths(ageMonths);
  const table = LAB_NORMS[biomarkerKey];
  if (!table) return null;
  return table[band] ?? null;
}

/**
 * warning — жумшак четки тышында (12% диапазон).
 * critical — андан дагы алыс (Soft Coral стил).
 */
export function getStatus(
  value: number,
  norm: LabNormEntry | null,
): MedicalStatus {
  if (norm == null || Number.isNaN(value)) return "normal";
  const { min, max } = norm;
  const span = Math.max(max - min, Math.abs(min) * 0.05, 1e-6);
  const margin = span * 0.12;

  if (value >= min && value <= max) return "normal";

  const lowWarn = min - margin;
  const highWarn = max + margin;
  if (value >= lowWarn && value < min) return "warning";
  if (value > max && value <= highWarn) return "warning";

  return "critical";
}

export function statusForBiomarker(
  biomarker: ParsedBiomarker,
  dob: string | Date | null | undefined,
): MedicalStatus {
  const key = normalizeBiomarkerKey(biomarker.biomarker);
  if (!key) return "normal";
  const months = ageInMonthsFromDob(dob);
  const norm = getNormForBiomarker(key, months);
  return getStatus(biomarker.value, norm);
}

export function worstStatus(a: MedicalStatus, b: MedicalStatus): MedicalStatus {
  const rank: Record<MedicalStatus, number> = {
    normal: 0,
    warning: 1,
    critical: 2,
  };
  return rank[a] >= rank[b] ? a : b;
}

export function analysisWorstStatus(
  data: unknown,
  dob: string | Date | null | undefined,
): MedicalStatus {
  if (!data || typeof data !== "object") return "normal";
  const d = data as HealthRecordAnalysisPayload;
  if (!Array.isArray(d.biomarkers)) return "normal";
  let w: MedicalStatus = "normal";
  for (const b of d.biomarkers) {
    w = worstStatus(w, statusForBiomarker(b, dob));
  }
  return w;
}

export function isProfileChild(dob: string | Date | null | undefined): boolean {
  const m = ageInMonthsFromDob(dob);
  return ageBandFromMonths(m) !== "adult";
}

export function getSmartTip(
  biomarkerLabel: string,
  status: MedicalStatus,
  isChild: boolean,
): string | null {
  if (status === "normal") return null;
  const who = isChild ? "бала" : "чоң киши";
  if (status === "warning") {
    return `${biomarkerLabel}: көрсөткүч чекенде жакын (${who}). Кайра анализ же дарыерге кеңеш сунушталат — өзүңүздү дарылоо баштабаңыз.`;
  }
  return `${biomarkerLabel}: көрсөткүч нормадан айырмаланат (${who}). ${isChild ? "Педиатрга жазылыңыз" : "Тейлөөчү дарыерге кайрылыңыз"}; өзүңүздү диагноз койбоңуз.`;
}

export type DynamicsPoint = {
  t: string;
  value: number;
  recordId: string;
  /** Статус точки относительно нормы (для тултипа графика). */
  status?: MedicalStatus;
};

/** Бир көрсөткүч боюнча убакыт тартиби (эски → жаңы). */
export function buildBiomarkerSeries(
  analyses: LabAnalysisRow[],
  biomarkerDisplayName: string,
  dob?: string | Date | null,
): DynamicsPoint[] {
  const key = normalizeBiomarkerKey(biomarkerDisplayName);
  if (!key) return [];

  const points: DynamicsPoint[] = [];
  for (const row of analyses) {
    if (!row.data || typeof row.data !== "object") continue;
    const d = row.data as HealthRecordAnalysisPayload;
    if (!Array.isArray(d.biomarkers)) continue;
    const hit = d.biomarkers.find(
      (b) => normalizeBiomarkerKey(b.biomarker) === key,
    );
    if (!hit) continue;
    points.push({
      t: row.createdAt,
      value: hit.value,
      recordId: row.id,
      status: statusForBiomarker(hit, dob),
    });
  }
  points.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
  return points;
}

export function unitForBiomarkerKey(
  analyses: LabAnalysisRow[],
  key: string,
): string {
  for (const row of analyses) {
    if (!row.data || typeof row.data !== "object") continue;
    const d = row.data as HealthRecordAnalysisPayload;
    if (!Array.isArray(d.biomarkers)) continue;
    const m = d.biomarkers.find(
      (b) => normalizeBiomarkerKey(b.biomarker) === key,
    );
    if (m) return m.unit;
  }
  return "";
}

export function listBiomarkersWithDynamics(
  analyses: LabAnalysisRow[],
  minPoints = 2,
): string[] {
  const counts = new Map<string, number>();
  for (const row of analyses) {
    if (!row.data || typeof row.data !== "object") continue;
    const d = row.data as HealthRecordAnalysisPayload;
    if (!Array.isArray(d.biomarkers)) continue;
    for (const b of d.biomarkers) {
      const k = normalizeBiomarkerKey(b.biomarker);
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .filter(([, n]) => n >= minPoints)
    .map(([k]) => k);
}
