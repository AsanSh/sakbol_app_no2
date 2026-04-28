/**
 * Извлекает 9-значный код приглашения из текста QR (t.me, join-family, join_…).
 */
export function extractInviteCode9FromScannedText(text: string): string | null {
  const t = text.trim();
  if (!t) return null;

  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://example.com";
    const u = new URL(t, base);
    const q = u.searchParams.get("code")?.replace(/\D/g, "").slice(0, 9);
    if (q?.length === 9) return q;
    const hash = u.hash.replace(/^#/, "");
    if (hash) {
      const fromHash = new URLSearchParams(hash).get("code")?.replace(/\D/g, "").slice(0, 9);
      if (fromHash?.length === 9) return fromHash;
    }
  } catch {
    /* не URL */
  }

  const joinUnderscore = t.match(/join_(\d{9})\b/i);
  if (joinUnderscore) return joinUnderscore[1];

  const startParam = t.match(/(?:start|startapp)=join_(\d{9})/i);
  if (startParam) return startParam[1];

  const nine = t.match(/\b(\d{9})\b/);
  if (nine) return nine[1];

  const digitsOnly = t.replace(/\D/g, "");
  if (digitsOnly.length === 9) return digitsOnly;

  return null;
}
