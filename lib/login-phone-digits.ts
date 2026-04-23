import "server-only";

/**
 * Одна строка цифр (без +) для `Profile.webLoginPhoneDigits`.
 * 9 цифр подряд без кода страны — не нормализуем (часто это id Telegram, не телефон).
 */
export function normalizeWebLoginPhoneDigits(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 9) return null;
  if (d.length > 20) return d.slice(0, 20);

  if (d.length === 12 && d.startsWith("996")) return d;
  if (d.length === 9 && /^[5-7]\d{8}$/.test(d)) return `996${d}`;
  if (d.length === 10 && d.startsWith("0") && /^0[5-7]\d{8}$/.test(d)) return `996${d.slice(1)}`;
  if (d.length === 9) return null;
  if (d.length >= 10 && d.length <= 16) return d;
  return d.length > 9 ? d : null;
}
