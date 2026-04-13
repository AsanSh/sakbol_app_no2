/**
 * Демо-скрабинг текста перед логированием/отправкой: ФИО, даты, ИНН/паспорт.
 * Реальный пайплайн требует модели NER; здесь — эвристики для UX «как будет».
 */
const CYR_WORD = "[\\u0410-\\u042F\\u0401][\\u0430-\\u044F\\u0451]+";

export function scrubPlainTextForStorage(text: string, anonymId: string): string {
  let t = text;
  const fio = new RegExp(`\\b${CYR_WORD}(?:\\s+${CYR_WORD}){1,3}\\b`, "g");
  t = t.replace(fio, anonymId);
  t = t.replace(/\b\d{2}\.\d{2}\.\d{4}\b/g, anonymId);
  t = t.replace(/\b\u0418\u041D\u041D\s*:?\s*\d{10,14}\b/gi, `${anonymId} (ИНН)`);
  t = t.replace(
    /\b(?:\u043F\u0430\u0441\u043F\u043E\u0440\u0442|ID)\s*:?\s*[A-Za-z\u0410-\u042F\u0430-\u044F\u0401\u04510-9\-]{5,}\b/gi,
    anonymId,
  );
  return t;
}
