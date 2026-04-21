/**
 * Имя файла пришло как UTF-8, прочитанное байтово как Latin-1 (часто Telegram / старые клиенты).
 * Пример: "Ð½ÐµÐ²Ñ€Ð¾Ð»Ð¾Ð³" → "невролог"
 */
export function normalizeUploadedFilename(name: string): string {
  const t = name.trim().replace(/^.*[/\\]/, "");
  if (!t) return t;
  if (/[а-яА-ЯёЁ]/.test(t) && !/[ÐÑÂâ€]/.test(t)) return t;
  try {
    const buf = new Uint8Array(t.length);
    for (let i = 0; i < t.length; i++) buf[i] = t.charCodeAt(i) & 0xff;
    const dec = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    if (dec.includes("\uFFFD")) return t;
    if (/[\u0400-\u04FF]/.test(dec)) return dec;
  } catch {
    /* ignore */
  }
  return t;
}
