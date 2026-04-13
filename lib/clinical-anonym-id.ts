/** Стабильный клинический псевдо-ID для подписи файлов и скрабинга (не PHI). */
export function formatClinicalAnonymId(profileId: string): string {
  const alnum = profileId.replace(/[^a-zA-Z0-9]/g, "");
  const part = (alnum.slice(0, 8) || "DEMO").toUpperCase().padEnd(4, "X").slice(0, 8);
  return `KG-${part}-2026`;
}
