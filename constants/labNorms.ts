/**
 * Билим берүүчү диапазондор (клиникалык чечим эмес).
 * Кеңейтүү: жаңы ключ кошуп, ageBands үчүн min/max жазыңыз.
 */

export type AgeBand = "infant" | "child" | "adult";

/** Чекенде: 0–23 ай, child: 2–17 жаш, adult: 18+ */
export const AGE_BAND_MONTHS = {
  infantMax: 23,
  /** 2 жаштан 18 жашка чейин (аяктагы ай менен) */
  childMax: 17 * 12 + 11,
} as const;

export type LabNormEntry = {
  min: number;
  max: number;
};

export type BiomarkerNorms = Record<AgeBand, LabNormEntry>;

/** Негизги көрсөткүчтөр (аталышы ParsedBiomarker менен дал келиши керек). */
export const LAB_NORMS: Record<string, BiomarkerNorms> = {
  Гемоглобин: {
    infant: { min: 95, max: 133 },
    child: { min: 110, max: 145 },
    adult: { min: 120, max: 160 },
  },
  Глюкоза: {
    infant: { min: 3.0, max: 5.6 },
    child: { min: 3.3, max: 5.6 },
    adult: { min: 3.9, max: 6.0 },
  },
  Ферритин: {
    infant: { min: 12, max: 140 },
    child: { min: 7, max: 140 },
    adult: { min: 15, max: 200 },
  },
  ТТГ: {
    infant: { min: 0.7, max: 6.5 },
    child: { min: 0.7, max: 4.5 },
    adult: { min: 0.4, max: 4.0 },
  },
  "Витамин D": {
    infant: { min: 20, max: 100 },
    child: { min: 20, max: 80 },
    adult: { min: 30, max: 100 },
  },
  /** Мок-данные менен келген англис аталыштары */
  Лейкоциттер: {
    infant: { min: 6, max: 17 },
    child: { min: 4.5, max: 13.5 },
    adult: { min: 4.0, max: 9.0 },
  },
  Тромбоциттер: {
    infant: { min: 150, max: 450 },
    child: { min: 150, max: 400 },
    adult: { min: 150, max: 400 },
  },
  Креатинин: {
    infant: { min: 20, max: 80 },
    child: { min: 35, max: 85 },
    adult: { min: 62, max: 106 },
  },
  /** Общий холестерин, ммоль/л — ориентир для UI (не целевой LDL). */
  Холестерин: {
    infant: { min: 2.5, max: 5.1 },
    child: { min: 2.9, max: 5.2 },
    adult: { min: 3.0, max: 5.2 },
  },
  /** ЛПНП, ммоль/л — грубый ориентир. */
  ЛПНП: {
    infant: { min: 1.2, max: 2.8 },
    child: { min: 1.5, max: 3.0 },
    adult: { min: 1.4, max: 3.0 },
  },
  /** ЛПВП, ммоль/л — выше в пределах «нормы» для UI. */
  ЛПВП: {
    infant: { min: 0.35, max: 2.2 },
    child: { min: 0.9, max: 2.2 },
    adult: { min: 1.0, max: 2.5 },
  },
};
