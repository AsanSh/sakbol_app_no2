import type { LabAnalysisRow } from "@/types/family";
import type { HealthRecordAnalysisPayload, ParsedBiomarker } from "@/types/biomarker";
import {
  normalizeBiomarkerKey,
  statusForBiomarker,
  type MedicalStatus,
} from "@/lib/medical-logic";

export type AnalysisCompareRow = {
  /** Подпись строки (как в бланке). */
  label: string;
  unit: string;
  earlier: ParsedBiomarker | null;
  later: ParsedBiomarker | null;
  earlierVal: number | null;
  laterVal: number | null;
  delta: number | null;
  /** Процент от |более раннего|, если можно посчитать. */
  deltaPct: number | null;
  statusEarlier: MedicalStatus;
  statusLater: MedicalStatus;
};

function asPayload(data: unknown): HealthRecordAnalysisPayload | null {
  if (!data || typeof data !== "object") return null;
  const d = data as HealthRecordAnalysisPayload;
  if (!Array.isArray(d.biomarkers)) return null;
  return d;
}

function indexByNormalizedKey(biomarkers: ParsedBiomarker[]): Map<string, ParsedBiomarker> {
  const m = new Map<string, ParsedBiomarker>();
  for (const b of biomarkers) {
    const nk = normalizeBiomarkerKey(b.biomarker);
    const key = nk ?? `__raw__:${b.biomarker.trim().toLowerCase()}`;
    m.set(key, b);
  }
  return m;
}

/**
 * Сравнение двух записей: baseline (раньше по времени) vs followup (позже).
 */
export function buildAnalysisCompareRows(
  baseline: LabAnalysisRow,
  followup: LabAnalysisRow,
  dob: string | Date | null | undefined,
): AnalysisCompareRow[] {
  const p0 = asPayload(baseline.data);
  const p1 = asPayload(followup.data);
  if (!p0?.biomarkers.length && !p1?.biomarkers.length) return [];

  const map0 = indexByNormalizedKey(p0?.biomarkers ?? []);
  const map1 = indexByNormalizedKey(p1?.biomarkers ?? []);
  const keys = Array.from(
    new Set([...Array.from(map0.keys()), ...Array.from(map1.keys())]),
  );

  const out: AnalysisCompareRow[] = [];
  for (const k of keys) {
    const earlier = map0.get(k) ?? null;
    const later = map1.get(k) ?? null;
    const label = earlier?.biomarker ?? later?.biomarker ?? k.replace(/^__raw__:/, "");
    const unit = later?.unit ?? earlier?.unit ?? "";

    const ev = earlier?.value ?? null;
    const lv = later?.value ?? null;
    let delta: number | null = null;
    let deltaPct: number | null = null;
    if (ev != null && lv != null) {
      delta = lv - ev;
      if (ev !== 0) deltaPct = (delta / Math.abs(ev)) * 100;
    }

    const statusEarlier: MedicalStatus = earlier ? statusForBiomarker(earlier, dob) : "normal";
    const statusLater: MedicalStatus = later ? statusForBiomarker(later, dob) : "normal";

    out.push({
      label,
      unit,
      earlier,
      later,
      earlierVal: ev,
      laterVal: lv,
      delta,
      deltaPct,
      statusEarlier,
      statusLater,
    });
  }

  out.sort((a, b) => {
    const rank = (r: AnalysisCompareRow) => {
      let s = 0;
      if (r.statusLater === "critical" || r.statusEarlier === "critical") s += 100;
      else if (r.statusLater === "warning" || r.statusEarlier === "warning") s += 40;
      if (r.delta != null && Math.abs(r.delta) > 1e-9) s += 20;
      return s;
    };
    const d = rank(b) - rank(a);
    if (d !== 0) return d;
    return a.label.localeCompare(b.label, "ru");
  });

  return out;
}

/** Упорядочить по дате; вернуть пару (раньше, позже). */
export function orderAnalysesChronologically(
  a: LabAnalysisRow,
  b: LabAnalysisRow,
): { baseline: LabAnalysisRow; followup: LabAnalysisRow } {
  const ta = new Date(a.createdAt).getTime();
  const tb = new Date(b.createdAt).getTime();
  if (ta <= tb) return { baseline: a, followup: b };
  return { baseline: b, followup: a };
}
