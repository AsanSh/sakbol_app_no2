import type { BiologicalSex } from "@prisma/client";

/**
 * Образовательные оценки риска (не клиническое решение).
 *
 * FINDRISC — финский опросник (Diabetes.fi / FINDRISC), сумма баллов.
 *
 * SCORE — упрощённая ориентировочная оценка 10-летнего риска фатальной ССЗ
 * для регионов низкого риска (Европа): используется грубая аппроксимация
 * по возрасту, полу, курению, САД и общему холестерину, когда нет номограммы.
 * Точные таблицы ESC — в оригинальных картах; здесь — демонстрация для UI.
 *
 * Онкология: без формул в коде — возрастные ориентиры скрининга (инфо).
 */

import type { LabAnalysisRow } from "@/types/family";
import type { HealthRecordAnalysisPayload } from "@/types/biomarker";
import { normalizeBiomarkerKey } from "@/lib/medical-logic";

export type Sex = "male" | "female";

export function biologicalSexToRiskSex(s: BiologicalSex): Sex {
  if (s === "MALE") return "male";
  return "female";
}

export type FindriscBand = "low" | "slight" | "moderate" | "high" | "very_high";

export type RiskTone = "ok" | "warn" | "bad";

export function ageYearsFromIsoDob(dob: string | null | undefined): number {
  if (!dob) return 45;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 45;
  const now = new Date();
  let y = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) y -= 1;
  return Math.max(18, Math.min(100, y));
}

/** Последнее числовое значение показателя (самый новый анализ). */
export function latestBiomarkerNumber(
  analyses: LabAnalysisRow[],
  canonicalKeys: string[],
): number | null {
  const keys = canonicalKeys
    .map((k) => normalizeBiomarkerKey(k))
    .filter((k): k is string => k != null);
  const want = new Set(keys);
  if (want.size === 0) return null;

  let best: { t: number; v: number } | null = null;
  for (const row of analyses) {
    if (!row.data || typeof row.data !== "object") continue;
    const d = row.data as HealthRecordAnalysisPayload;
    if (!Array.isArray(d.biomarkers)) continue;
    const ts = new Date(row.createdAt).getTime();
    for (const b of d.biomarkers) {
      const k = normalizeBiomarkerKey(b.biomarker);
      if (!k || !want.has(k)) continue;
      const v = Number(b.value);
      if (Number.isNaN(v)) continue;
      if (!best || ts >= best.t) best = { t: ts, v };
    }
  }
  return best?.v ?? null;
}

export type FindriscInput = {
  ageYears: number;
  sex: Sex;
  bmi: number | null;
  waistCm: number | null;
  /** Ежедневно ≥30 мин активности */
  physicallyActive: boolean;
  dailyVegetables: boolean;
  onAntihypertensive: boolean;
  historyHighGlucose: boolean;
  familyHistoryDiabetes: boolean;
};

/**
 * Баллы FINDRISC (сумма по вопросам).
 * Интерпретация: <7 низкий, 7–11 умеренный, 12–14 повышенный, 15–20 высокий, >20 очень высокий.
 */
export function computeFindriscPoints(input: FindriscInput): number {
  let s = 0;
  const a = input.ageYears;
  if (a < 45) s += 0;
  else if (a < 55) s += 2;
  else if (a < 65) s += 3;
  else s += 4;

  const bmi = input.bmi;
  if (bmi != null) {
    if (bmi < 25) s += 0;
    else if (bmi < 30) s += 1;
    else s += 3;
  }

  const w = input.waistCm;
  if (w != null) {
    if (input.sex === "male") {
      if (w < 94) s += 0;
      else if (w <= 102) s += 3;
      else s += 4;
    } else {
      if (w < 80) s += 0;
      else if (w <= 88) s += 3;
      else s += 4;
    }
  }

  s += input.physicallyActive ? 0 : 2;
  s += input.dailyVegetables ? 0 : 1;
  s += input.onAntihypertensive ? 2 : 0;
  s += input.historyHighGlucose ? 5 : 0;
  s += input.familyHistoryDiabetes ? 5 : 0;

  return s;
}

export function findriscBand(points: number): FindriscBand {
  if (points < 7) return "low";
  if (points <= 11) return "slight";
  if (points <= 14) return "moderate";
  if (points <= 20) return "high";
  return "very_high";
}

export type ScoreLikeInput = {
  ageYears: number;
  sex: Sex;
  smoker: boolean;
  systolicMmHg: number;
  totalCholesterolMmol: number;
};

/**
 * Грубая оценка риска (%) для демо-UI.
 * Реальная SCORE строится по номограммам; здесь:
 * \[
 *   \text{risk} \approx \frac{\text{age}-40}{120} + 0.12[\text{smoke}] + \frac{\max(0,\text{chol}-5)}{25} + \frac{\max(0,\text{sbp}-120)}{400}
 * \]
 * (без размерности, затем clamp 0.2–35%).
 */
export function estimateCardioRiskPercentDemo(input: ScoreLikeInput): number {
  const base = Math.max(0, input.ageYears - 40) / 120;
  const smoke = input.smoker ? 0.12 : 0;
  const chol = Math.max(0, input.totalCholesterolMmol - 5) / 25;
  const sbp = Math.max(0, input.systolicMmHg - 120) / 400;
  let r = base + smoke + chol + sbp;
  if (input.sex === "female") r *= 0.72;
  const pct = r * 100;
  return Math.round(Math.min(35, Math.max(0.2, pct)) * 10) / 10;
}

export function toneFromFindrisc(points: number): RiskTone {
  if (points < 7) return "ok";
  if (points <= 14) return "warn";
  return "bad";
}

export function toneFromCardioPercent(pct: number): RiskTone {
  if (pct < 2.5) return "ok";
  if (pct < 7.5) return "warn";
  return "bad";
}

/** Эвристика: глюкоза натощак / ПП — если > 6.1 ммоль/л в последнем анализе. */
export function inferHistoryHighGlucose(analyses: LabAnalysisRow[]): boolean {
  const g = latestBiomarkerNumber(analyses, ["Глюкоза", "Глюкоза крови"]);
  if (g == null) return false;
  return g > 6.1;
}

export function buildFindriscFromLabsAndProfile(
  analyses: LabAnalysisRow[],
  ageYears: number,
  sex: Sex,
): { points: number; band: FindriscBand; tone: RiskTone } {
  const input: FindriscInput = {
    ageYears,
    sex,
    bmi: null,
    waistCm: null,
    physicallyActive: true,
    dailyVegetables: true,
    onAntihypertensive: false,
    historyHighGlucose: inferHistoryHighGlucose(analyses),
    familyHistoryDiabetes: false,
  };
  const points = computeFindriscPoints(input);
  return {
    points,
    band: findriscBand(points),
    tone: toneFromFindrisc(points),
  };
}

export function buildCardioDemoFromLabs(
  analyses: LabAnalysisRow[],
  ageYears: number,
  sex: Sex,
): { percent: number; tone: RiskTone } {
  const chol =
    latestBiomarkerNumber(analyses, [
      "Холестерин",
      "Общий холестерин",
      "Холестерин общий",
    ]) ?? 5.2;
  const sbpRaw = latestBiomarkerNumber(analyses, [
    "САД",
    "Систолическое давление",
    "Систоликалык кысым",
    "АД систолическое",
  ]);
  const sbp =
    sbpRaw != null && sbpRaw > 40 && sbpRaw < 300 ? sbpRaw : 128;
  const percent = estimateCardioRiskPercentDemo({
    ageYears,
    sex,
    smoker: false,
    systolicMmHg: sbp,
    totalCholesterolMmol: chol,
  });
  return { percent, tone: toneFromCardioPercent(percent) };
}

export type OncologyHintLevel = "info" | "screening_40" | "screening_50";

export function oncologyScreeningHint(ageYears: number): OncologyHintLevel {
  if (ageYears >= 50) return "screening_50";
  if (ageYears >= 40) return "screening_40";
  return "info";
}

/**
 * Интегральный «индекс здоровья» 0–100 для круговой шкалы (образовательно).
 */
export function overallHealthIndex(
  findriscPoints: number,
  cardioPct: number,
  worstLabStatusScore: number,
): number {
  // worstLabStatusScore: 0 normal, 1 warn, 2 critical (from caller)
  const f = Math.min(40, findriscPoints * 1.8);
  const c = Math.min(35, cardioPct * 3.5);
  const l = worstLabStatusScore * 12;
  return Math.round(Math.max(0, Math.min(100, 100 - f - c - l)));
}
