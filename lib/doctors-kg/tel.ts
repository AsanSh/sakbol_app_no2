/** Цифры для tel: — на мобильных и в WebView (Telegram) корректно открывает набор. */
export function normalizeTelHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("996") && digits.length >= 9) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+996${digits}`;
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return `+996${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/**
 * Вызывает набор номера (жест пользователя → программный клик по tel: часто работает в Telegram Mini App,
 * где присвоение window.location.href блокируется).
 */
export function openTelDial(raw: string): void {
  if (typeof document === "undefined") return;
  const h = normalizeTelHref(raw);
  if (!h) return;
  const uri = `tel:${h}`;

  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } })
      .Telegram?.WebApp;
    tg?.openLink?.(uri);
  } catch {
    /* ignore */
  }

  const a = document.createElement("a");
  a.href = uri;
  a.setAttribute("rel", "noreferrer");
  document.body.appendChild(a);
  a.click();
  a.remove();
}
