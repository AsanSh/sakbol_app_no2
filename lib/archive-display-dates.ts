/** Подписи дат для архива: дата с документа или дата загрузки. */

export function archivePrimaryDateLabel(
  documentDate: string | null,
  createdAt: string,
  locale: string,
  now = new Date(),
): { primary: string; hint?: string } {
  if (documentDate) {
    const d = new Date(documentDate);
    return {
      primary: d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }),
    };
  }
  const created = new Date(createdAt);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startCreated = new Date(created);
  startCreated.setHours(0, 0, 0, 0);
  if (startCreated.getTime() === startToday.getTime()) {
    return {
      primary: "Сегодня",
      hint: `Загружено ${created.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`,
    };
  }
  return {
    primary: created.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }),
    hint: "Дата на документе не указана",
  };
}

export const ARCHIVE_CATEGORY_RU: Record<string, string> = {
  ANALYSIS: "Анализ",
  DISCHARGE_SUMMARY: "Выписка",
  PROTOCOL: "Протокол",
  PRESCRIPTION: "Рецепт",
  CONTRACT: "Договор",
  OTHER: "Документ",
};
