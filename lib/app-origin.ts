import "server-only";

/** Абсолютный origin публичного сайта (кнопки в Telegram, ссылки в боте). */
export function getServerAppOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const v = process.env.VERCEL_URL?.trim();
  if (v) {
    const s = v.replace(/\/$/, "");
    return s.startsWith("http") ? s : `https://${s}`;
  }
  return "http://localhost:3000";
}
