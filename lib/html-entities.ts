/** Декодирует типичные HTML-сущности в тексте из JSON-LD / WordPress (напр. &nbsp;, &#8212;). */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
