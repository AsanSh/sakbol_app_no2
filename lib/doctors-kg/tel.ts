/** Цифры для tel: — на мобильных корректно открывает набор. */
export function normalizeTelHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("996") && digits.length >= 9) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+996${digits}`;
  }
  return `+${digits}`;
}
