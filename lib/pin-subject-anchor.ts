/**
 * Привязка субъекта (ребёнок / взрослый) к ПИН/ИНН в контексте КР.
 *
 * **Термины:** в Кыргызстане ПИН и ИНН в быту часто называют одним номером идентификации;
 * для SakBol важно не хранить сырое значение на сервере.
 *
 * **Целевой поток (будущая реализация):**
 * 1. На устройстве пользователь вводит ПИН только локально (или он приходит с OCR после скана).
 * 2. Клиент нормализует строку и отправляет на сервер **только необратимый якорь**
 *    `pinAnchor` (например HMAC-SHA256 с секретом `PIN_ANCHOR_PEPPER` — тот же алгоритм на OCR-пайплайне).
 * 3. При регистрации / «Добавить члена семьи» сервер создаёт/находит `Profile` и сохраняет
 *    `pinAnchor` (уникальный индекс в рамках семьи или глобально — по продуктовым правилам).
 * 4. Клинический UI-ID (`formatClinicalAnonymId` и т.п.) остаётся для экрана; ФИО и ПИН в БД не пишутся.
 * 5. После сканирования бланка OCR извлекает ПИН → тот же якорь → автопривязка анализа к профилю.
 *
 * Здесь только утилиты и контракт; поля Prisma добавляются отдельной миграцией.
 */

import { createHmac } from "crypto";

/** Секрет для HMAC якоря ПИН. В production обязателен в env. */
export function getPinAnchorPepper(): string {
  const p = process.env.PIN_ANCHOR_PEPPER?.trim();
  if (p && p.length >= 16) return p;
  if (process.env.NODE_ENV !== "production") {
    // Ровно 16 символов — тот же минимум, что в production (удобно для локальных проверок длины).
    return "devpinanchorxx16";
  }
  throw new Error("PIN_ANCHOR_PEPPER must be set (min 16 characters).");
}

/** Убрать пробелы; ПИН в КР обычно только цифры */
export function normalizeKgPinInput(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

/** Допустимая длина цифрового ПИН/ИНН (запас под разные форматы). */
export function assertValidPinFormat(normalized: string): string | null {
  if (!/^\d{10,20}$/.test(normalized)) {
    return "ПИН/ИНН: введите от 10 до 20 цифр без пробелов.";
  }
  return null;
}

/**
 * Кыргызстан: 14-значный ПИН — цифры 2–7 (индексы 1…6) — дата рождения **ДДММГГ**
 * (1-я цифра — пол/гражданство). Для ИНН другой длины или других стран — `null`.
 * При двусмысленности 19xx/20xx выбирается более поздняя допустимая дата (не в будущем, не старше ~120 лет).
 */
export function dateOfBirthFromKg14Pin(normalizedPin: string): Date | null {
  const n = normalizeKgPinInput(normalizedPin);
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

/**
 * Стабильный якорь для сопоставления одного и того же ПИН с разных каналов (форма, OCR).
 * На сервере и в воркере OCR использовать один и тот же `pepper` из env.
 */
export function pinAnchorFromNormalizedPin(normalizedPin: string, pepper: string): string {
  const p = normalizedPin.trim();
  if (!p) throw new Error("PIN empty after normalize");
  if (!pepper || pepper.length < 16) {
    throw new Error("PIN_ANCHOR_PEPPER must be set (min 16 chars)");
  }
  return createHmac("sha256", pepper).update(p, "utf8").digest("hex");
}

export function pinAnchorFromUserInput(rawPin: string): string {
  const n = normalizeKgPinInput(rawPin);
  const fmt = assertValidPinFormat(n);
  if (fmt) throw new Error(fmt);
  return pinAnchorFromNormalizedPin(n, getPinAnchorPepper());
}
