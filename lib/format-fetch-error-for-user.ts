/**
 * Map low-level fetch() failures to readable copy.
 * WebKit (incl. Telegram WebView) often uses message "Load failed";
 * Chromium uses "Failed to fetch" / "NetworkError when attempting to fetch resource."
 */
export function formatFetchErrorForUser(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.";
  }
  const raw = error.message.trim();
  const lower = raw.toLowerCase();

  if (
    lower === "load failed" ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror when attempting to fetch resource") ||
    lower === "network request failed"
  ) {
    return "Нет соединения с сервером. Проверьте интернет и VPN, откройте сайт в браузере; если открывается — закройте мини-приложение и откройте снова из бота.";
  }
  if (error.name === "AbortError" || lower.includes("aborted")) {
    return "Запрос прерван или истекло время ожидания. Попробуйте снова.";
  }
  return raw || "Не удалось связаться с сервером.";
}
