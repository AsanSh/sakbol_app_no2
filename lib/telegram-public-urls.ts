/** Публичные ссылки на бота (env NEXT_PUBLIC_TELEGRAM_BOT_USERNAME, без @). */

export function telegramBotUsernameFromEnv(): string {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ?? "";
}

/** Ссылка для запуска Web App из чата с ботом (?startapp). */
export function telegramMiniAppStartUrlFromEnv(): string | null {
  const u = telegramBotUsernameFromEnv();
  if (!u) return null;
  return `https://t.me/${u}?startapp`;
}
