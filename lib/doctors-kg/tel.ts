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

/** Набор номера: см. `triggerPhoneCall` в `@/lib/callDoctor`. */
