/** Синхронная проверка окружения Telegram Mini App в браузере (без SDK). */
export function clientLooksLikeTelegramWebApp(): boolean {
  if (typeof window === "undefined") return false;
  if (/tgWebAppData|tgWebAppVersion|tgWebAppPlatform/i.test(window.location.hash)) return true;
  try {
    const user = (
      window as Window & {
        Telegram?: { WebApp?: { initDataUnsafe?: { user?: unknown } } };
      }
    ).Telegram?.WebApp?.initDataUnsafe?.user;
    return user != null;
  } catch {
    return false;
  }
}
