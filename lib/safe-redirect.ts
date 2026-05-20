/**
 * Безопасный внутренний редирект после входа (защита от open redirect).
 */
export function safePostLoginPath(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s.startsWith("/")) return "/";
  if (s.startsWith("//")) return "/";
  if (s.includes("\\")) return "/";
  if (s.startsWith("/login")) return "/";
  return s;
}
