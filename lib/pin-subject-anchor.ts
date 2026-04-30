/**
 * Привязка субъекта к гос. идентификатору без хранения сырого номера в БД.
 * KG: якорь = HMAC(pepper, digits) — как раньше (OCR и старые записи).
 * KZ / UZ / RU: якорь = HMAC(pepper, "CC:digits") чтобы не пересекаться с KG при той же строке цифр.
 */

import { createHmac } from "crypto";
import {
  normalizeSubjectIdDigits,
  validateSubjectIdForCountry,
} from "@/lib/subject-id-country";
import type { SubjectIdCountry } from "@prisma/client";

/** Секрет для HMAC якоря ПИН. В production обязателен в env. */
export function getPinAnchorPepper(): string {
  const p = process.env.PIN_ANCHOR_PEPPER?.trim();
  if (p && p.length >= 16) return p;
  if (process.env.NODE_ENV !== "production") {
    return "devpinanchorxx16";
  }
  throw new Error("PIN_ANCHOR_PEPPER must be set (min 16 characters).");
}

/** @deprecated используйте normalizeSubjectIdDigits */
export function normalizeKgPinInput(raw: string): string {
  return normalizeSubjectIdDigits(raw);
}

/**
 * Кыргызстан: 14-значный ПИН — цифры 2–7 (индексы 1…6) — дата рождения **ДДММГГ**
 */
export function dateOfBirthFromKg14Pin(normalizedPin: string): Date | null {
  const n = normalizeSubjectIdDigits(normalizedPin);
  if (!/^\d{14}$/.test(n)) return null;
  const dd = parseInt(n.slice(1, 3), 10);
  const mm = parseInt(n.slice(3, 5), 10);
  const yy = parseInt(n.slice(5, 7), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const now = new Date();
  const maxTs = now.getTime() + 86400000;
  const minYear = now.getFullYear() - 120;

  let best: Date | null = null;
  for (const century of [2000, 1900]) {
    const year = century + yy;
    if (year < minYear) continue;
    const d = new Date(Date.UTC(year, mm - 1, dd));
    if (Number.isNaN(d.getTime()) || d.getUTCDate() !== dd) continue;
    if (d.getTime() > maxTs) continue;
    if (!best || d.getTime() > best.getTime()) best = d;
  }
  return best;
}

/** Якорь только по цифрам (Кыргызстан / совместимость). */
export function pinAnchorFromNormalizedPin(normalizedPin: string, pepper: string): string {
  const p = normalizedPin.trim();
  if (!p) throw new Error("PIN empty after normalize");
  if (!pepper || pepper.length < 16) {
    throw new Error("PIN_ANCHOR_PEPPER must be set (min 16 chars)");
  }
  return createHmac("sha256", pepper).update(p, "utf8").digest("hex");
}

/** Якорь для НЕ-KG стран (префикс страны в сообщении HMAC). */
export function pinAnchorFromCountryScoped(
  country: "KZ" | "UZ" | "RU",
  normalizedPin: string,
  pepper: string,
): string {
  const p = normalizedPin.trim();
  if (!p) throw new Error("PIN empty after normalize");
  if (!pepper || pepper.length < 16) {
    throw new Error("PIN_ANCHOR_PEPPER must be set (min 16 chars)");
  }
  const payload = `${country}:${p}`;
  return createHmac("sha256", pepper).update(payload, "utf8").digest("hex");
}

/**
 * Полный поток: нормализация, валидация по стране, стабильный якорь.
 */
export function pinAnchorFromUserInput(
  rawPin: string,
  country: SubjectIdCountry = "KG",
): string {
  const normalized = normalizeSubjectIdDigits(rawPin);
  const err = validateSubjectIdForCountry(country, normalized);
  if (err) throw new Error(err);

  const pepper = getPinAnchorPepper();
  if (country === "KG") {
    return pinAnchorFromNormalizedPin(normalized, pepper);
  }
  return pinAnchorFromCountryScoped(country, normalized, pepper);
}
