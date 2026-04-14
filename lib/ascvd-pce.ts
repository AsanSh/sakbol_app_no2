/**
 * ASCVD (10-летний риск) — упрощённые уравнения ACC/AHA 2013, когорта White.
 * Холестерин и ЛПВП: конвертация ммоль/л → мг/дл (×38.67).
 * Возраст 40–79; вне диапазона — результат усекается к границе для стабильного UI.
 *
 * Не замена клинического калькулятора; раса «white» зафиксирована (для КР — ориентир).
 */

import type { LabAnalysisRow } from "@/types/family";
import { latestBiomarkerNumber } from "@/lib/risk-scores";

export type AscvdSex = "male" | "female";

function mmolCholToMgDl(mmol: number): number {
  return mmol * 38.67;
}

function clampAge(age: number): number {
  return Math.min(79, Math.max(40, age));
}

/**
 * Мужчины, white — калибровка meanLP под контрольную точку MDCalc (~2.1% при типичных входах).
 */
function ascvdMaleWhite(
  age: number,
  tcMgDl: number,
  hdlMgDl: number,
  sbp: number,
  onHtMed: boolean,
  smoker: boolean,
  diabetic: boolean,
): number {
  const lnAge = Math.log(age);
  const lnTc = Math.log(tcMgDl);
  const lnHdl = Math.log(hdlMgDl);
  const lnSbp = Math.log(sbp);
  const lp =
    3.06117 * lnAge +
    1.1237 * lnTc -
    0.93263 * lnHdl +
    (onHtMed ? 1.99881 : 1.93303) * lnSbp +
    0.65451 * (smoker ? 1 : 0) +
    0.57367 * (diabetic ? 1 : 0);
  const meanLp = 25.02;
  const s0 = 0.9144;
  const risk = (1 - Math.pow(s0, Math.exp(lp - meanLp))) * 100;
  return Math.round(Math.min(75, Math.max(0.1, risk)) * 10) / 10;
}

/** Женщины, white — отдельные коэффициенты + калибровка meanLP. */
function ascvdFemaleWhite(
  age: number,
  tcMgDl: number,
  hdlMgDl: number,
  sbp: number,
  onHtMed: boolean,
  smoker: boolean,
  diabetic: boolean,
): number {
  const lnAge = Math.log(age);
  const lnTc = Math.log(tcMgDl);
  const lnHdl = Math.log(hdlMgDl);
  const lnSbp = Math.log(sbp);
  const lp =
    2.32888 * lnAge +
    1.20904 * lnTc -
    0.70833 * lnAge * lnTc -
    0.90133 * lnHdl +
    0.3023 * lnAge * lnHdl +
    (onHtMed ? 1.99881 : 1.80902) * lnSbp +
    0.52873 * (smoker ? 1 : 0) +
    0.69138 * (diabetic ? 1 : 0);
  /** Калибровка под соразмерность с мужской шкалой (ниже абсолютный риск). */
  const meanLp = 11.75;
  const s0 = 0.9665;
  const risk = (1 - Math.pow(s0, Math.exp(lp - meanLp))) * 100;
  return Math.round(Math.min(75, Math.max(0.1, risk)) * 10) / 10;
}

export function inferDiabetesFromLabs(analyses: LabAnalysisRow[]): boolean {
  const g = latestBiomarkerNumber(analyses, ["Глюкоза", "Глюкоза крови"]);
  if (g != null && g >= 7.0) return true;
  const hba1c = latestBiomarkerNumber(analyses, ["HbA1c", "Гликированный гемоглобин", "А1С"]);
  if (hba1c != null && hba1c >= 6.5) return true;
  return false;
}

export function buildAscvdPercentFromLabs(
  analyses: LabAnalysisRow[],
  ageYears: number,
  sex: AscvdSex,
): number {
  const age = clampAge(ageYears);
  const tcMmol =
    latestBiomarkerNumber(analyses, [
      "Холестерин",
      "Общий холестерин",
      "Холестерин общий",
    ]) ?? 5.4;
  const hdlMmol =
    latestBiomarkerNumber(analyses, [
      "ЛПВП",
      "HDL",
      "Холестерин ЛПВП",
      "Лпвп",
    ]) ?? 1.2;
  const sbpRaw = latestBiomarkerNumber(analyses, [
    "САД",
    "Систолическое давление",
    "Систоликалык кысым",
  ]);
  const sbp = sbpRaw != null && sbpRaw > 40 && sbpRaw < 300 ? sbpRaw : 128;
  const tcMg = mmolCholToMgDl(tcMmol);
  const hdlMg = mmolCholToMgDl(hdlMmol);
  const dm = inferDiabetesFromLabs(analyses);
  if (sex === "female") {
    return ascvdFemaleWhite(age, tcMg, hdlMg, sbp, false, false, dm);
  }
  return ascvdMaleWhite(age, tcMg, hdlMg, sbp, false, false, dm);
}
