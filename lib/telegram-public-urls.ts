/** Публичные ссылки на бота (env NEXT_PUBLIC_TELEGRAM_BOT_USERNAME, без @). */

export function telegramBotUsernameFromEnv(): string {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ?? "";
}

/** Ссылка для запуска Web App из чата с ботом (?startapp=payload). */
export function telegramMiniAppStartUrlFromEnv(startParam?: string): string | null {
  const u = telegramBotUsernameFromEnv();
  if (!u) return null;
  const payload = startParam?.trim();
  return payload ? `https://t.me/${u}?startapp=${encodeURIComponent(payload)}` : `https://t.me/${u}?startapp`;
}
