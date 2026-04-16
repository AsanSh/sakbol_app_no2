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
    return "dev-only-pin-pepper-min16!!";
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
