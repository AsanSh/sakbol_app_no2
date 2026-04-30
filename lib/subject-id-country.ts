/**
 * Страна гос. идентификатора физлица и правила валидации длины (ИИН/ПИН/ПИНФЛ/СНИЛС).
 * Серверные якоря для KZ/UZ/RU отличаются от KG — см. `lib/pin-subject-anchor.ts`.
 */
import { SubjectIdCountry } from "@prisma/client";

export { SubjectIdCountry };

export const SUBJECT_ID_COUNTRY_OPTIONS: {
  value: SubjectIdCountry;
  label: string;
  docHint: string;
}[] = [
  {
    value: SubjectIdCountry.KG,
    label: "Кыргызстан",
    docHint: "ПИН — 14 цифр; старый ИНН в паспорте — 10–12 цифр",
  },
  {
    value: SubjectIdCountry.KZ,
    label: "Казахстан",
    docHint: "ИИН — 12 цифр",
  },
  {
    value: SubjectIdCountry.UZ,
    label: "Узбекистан",
    docHint: "ПИНФЛ — 14 цифр",
  },
  {
    value: SubjectIdCountry.RU,
    label: "Россия",
    docHint: "СНИЛС — 11 цифр или ИНН — 12 цифр",
  },
];

export function subjectIdDocLabel(country: SubjectIdCountry): string {
  switch (country) {
    case SubjectIdCountry.KG:
      return "ПИН / ИНН (КР)";
    case SubjectIdCountry.KZ:
      return "ИИН";
    case SubjectIdCountry.UZ:
      return "ПИНФЛ";
    case SubjectIdCountry.RU:
      return "СНИЛС или ИНН";
    default:
      return "Идентификатор";
  }
}

/** Цифры без пробелов и без типичных разделителей СНИЛС */
export function normalizeSubjectIdDigits(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/-/g, "").trim();
}

export function maxDigitsForCountry(country: SubjectIdCountry): number {
  switch (country) {
    case SubjectIdCountry.RU:
      return 12;
    case SubjectIdCountry.KZ:
      return 12;
    case SubjectIdCountry.UZ:
      return 14;
    case SubjectIdCountry.KG:
    default:
      return 14;
  }
}

/**
 * Подсказка по `language_code` из Telegram (часто `ru` — неоднозначно, тогда null).
 */
export function inferSubjectIdCountryFromTelegramLang(
  languageCode: string | undefined | null,
): SubjectIdCountry | null {
  if (!languageCode) return null;
  const base = languageCode.toLowerCase().split(/[-_]/)[0] ?? "";
  if (base === "kk") return SubjectIdCountry.KZ;
  if (base === "ky") return SubjectIdCountry.KG;
  if (base === "uz") return SubjectIdCountry.UZ;
  return null;
}

export function parseSubjectIdCountryParam(
  raw: string | undefined | null,
): SubjectIdCountry {
  const u = (raw ?? "KG").toUpperCase();
  if (u === "KZ") return SubjectIdCountry.KZ;
  if (u === "UZ") return SubjectIdCountry.UZ;
  if (u === "RU") return SubjectIdCountry.RU;
  return SubjectIdCountry.KG;
}

/** Достаточно ли цифр для активации кнопки (грубая проверка) */
export function isSubjectIdLengthSatisfied(
  country: SubjectIdCountry,
  normalized: string,
): boolean {
  return validateSubjectIdForCountry(country, normalized) == null;
}

/** Сообщение об ошибке или null если ок */
export function validateSubjectIdForCountry(
  country: SubjectIdCountry,
  normalized: string,
): string | null {
  if (!/^\d+$/.test(normalized)) {
    return "Укажите только цифры (без пробелов).";
  }
  switch (country) {
    case SubjectIdCountry.KG:
      if (normalized.length === 14) return null;
      if (normalized.length >= 10 && normalized.length <= 12) return null;
      return "Кыргызстан: ПИН — 14 цифр или старый ИНН — 10–12 цифр.";
    case SubjectIdCountry.KZ:
      if (normalized.length === 12) return null;
      return "Казахстан: ИИН — ровно 12 цифр.";
    case SubjectIdCountry.UZ:
      if (normalized.length === 14) return null;
      return "Узбекистан: ПИНФЛ — ровно 14 цифр.";
    case SubjectIdCountry.RU:
      if (normalized.length === 11 || normalized.length === 12) return null;
      return "Россия: СНИЛС — 11 цифр или ИНН — 12 цифр.";
    default:
      return "Неизвестная страна.";
  }
}
