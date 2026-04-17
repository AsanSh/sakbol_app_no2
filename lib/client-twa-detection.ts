type TelegramWindow = Window & {
  Telegram?: { WebApp?: { initDataUnsafe?: { user?: unknown }; initData?: string } };
};

/** Клиент Telegram внедрил WebApp (внешний браузер внутри Telegram или Mini App). */
export function hasTelegramWebAppBridge(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean((window as TelegramWindow).Telegram?.WebApp);
  } catch {
    return false;
  }
}

/** Синхронная проверка: именно Mini App / ожидание initData (без загрузки SDK). */
export function clientLooksLikeTelegramWebApp(): boolean {
  if (typeof window === "undefined") return false;
  if (/tgWebAppData|tgWebAppVersion|tgWebAppPlatform/i.test(window.location.hash)) return true;
  try {
    const w = window as TelegramWindow;
    const user = w.Telegram?.WebApp?.initDataUnsafe?.user;
    if (user != null) return true;
    const init = w.Telegram?.WebApp?.initData;
    return typeof init === "string" && init.length > 0;
  } catch {
    return false;
  }
}
