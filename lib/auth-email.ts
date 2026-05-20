/** Нормализация email для входа и привязки. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
