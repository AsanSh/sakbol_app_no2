import type { HealthDocumentCategory } from "@prisma/client";

const TEXT_WINDOW = 24_000;

/** YYYY-MM-DD в полдень UTC (только календарная дата). */
export function parseYmdToUtcNoon(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function toYmd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

type ScoredDate = { ymd: string; score: number; index: number };

function scoreContext(textLower: string, index: number): number {
  const start = Math.max(0, index - 60);
  const frag = textLower.slice(start, index + 40);
  let s = 0;
  if (
    /дата\s*(забора|анализа|исследования|выписки|документа|пробы|назначения|результат)/.test(frag)
  )
    s += 12;
  if (/дата:/.test(frag)) s += 8;
  if (/от\s*\d{1,2}[./]\d{1,2}[./]\d{4}/.test(frag)) s += 4;
  if (/исследован|результат|бланк|лаборатор/.test(frag)) s += 3;
  return s;
}

/**
 * Ищет даты DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD и варианты около «дата забора».
 */
export function extractBestDocumentDate(rawText: string): string | null {
  const t = rawText.slice(0, TEXT_WINDOW);
  const lower = t.toLowerCase();
  const candidates: ScoredDate[] = [];
  const push = (y: number, m: number, d: number, index: number, bonus = 0) => {
    const ymd = toYmd(y, m, d);
    if (!ymd) return;
    const yearNow = new Date().getFullYear();
    if (y < 1990 || y > yearNow + 1) return;
    candidates.push({
      ymd,
      score: bonus + scoreContext(lower, index),
      index,
    });
  };

  const reLabeled =
    /дата\s*(?:забора|анализа|исследования|выписки|документа|пробы|назначения|результата)?\s*[:\s]+(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi;
  let m: RegExpExecArray | null;
  while ((m = reLabeled.exec(t)) !== null) {
    push(Number(m[3]), Number(m[2]), Number(m[1]), m.index, 10);
  }

  const reDmy = /\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g;
  while ((m = reDmy.exec(t)) !== null) {
    push(Number(m[3]), Number(m[2]), Number(m[1]), m.index, 0);
  }

  const reYmd = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = reYmd.exec(t)) !== null) {
    push(Number(m[1]), Number(m[2]), Number(m[3]), m.index, 1);
  }

  const reSlashIso = /\b(\d{4})[./](\d{1,2})[./](\d{1,2})\b/g;
  while ((m = reSlashIso.exec(t)) !== null) {
    push(Number(m[1]), Number(m[2]), Number(m[3]), m.index, 0);
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  const best = candidates[0];
  return best?.ymd ?? null;
}

const ANALYSIS_HINTS =
  /гемоглобин|эритроцит|лейкоцит|тромбоцит|соэ|глюкоз|холестерин|креатинин|билирубин|алт|аст|щелочн|общий\s+анализ\s+крови|оак|биохим|лаборатор|анализ\s+крови|анализ\s+мочи|гормон|витамин|мочевин|маркер|covid|пцр|клиническ|исследовани[ея]\s+крови/;

const DISCHARGE_HINTS =
  /выписка|эпикриз|выписной|заключение\s+выпис|истори[ия]\s+болезни|стационар|госпитализац/;

const PROTOCOL_HINTS = /протокол\s+осмотр|протокол\s+консультац|осмотр\s+врач|амбулаторн|приём\s+врач/;

const PRESCRIPTION_HINTS = /рецепт|назначен|rx\b|форма\s*№\s*148|медикамент|дозировк/;

const CONTRACT_HINTS = /договор|контракт|соглашени|оферт|платн[ые]\s+услуг/;

export function inferCategory(textLower: string): HealthDocumentCategory {
  if (ANALYSIS_HINTS.test(textLower)) return "ANALYSIS";
  if (DISCHARGE_HINTS.test(textLower)) return "DISCHARGE_SUMMARY";
  if (PRESCRIPTION_HINTS.test(textLower)) return "PRESCRIPTION";
  if (CONTRACT_HINTS.test(textLower)) return "CONTRACT";
  if (PROTOCOL_HINTS.test(textLower)) return "PROTOCOL";
  return "OTHER";
}

const TITLE_PATTERNS: { re: RegExp; title: string }[] = [
  { re: /общий\s+анализ\s+крови/i, title: "Общий анализ крови" },
  { re: /биохимическ(?:ий|ого)\s+анализ/i, title: "Биохимический анализ" },
  { re: /анализ\s+крови/i, title: "Анализ крови" },
  { re: /анализ\s+мочи/i, title: "Анализ мочи" },
  { re: /клиническ(?:ое|ий)\s+исследование/i, title: "Клиническое исследование" },
  { re: /выписка/i, title: "Выписка из медицинских документов" },
  { re: /эпикриз/i, title: "Эпикриз" },
  { re: /протокол/i, title: "Протокол" },
  { re: /рецепт/i, title: "Рецепт" },
  { re: /договор/i, title: "Договор" },
  { re: /направлени[ея]\s+(?:на|в)/i, title: "Направление" },
];

export function inferTitle(
  textLower: string,
  rawText: string,
  fileBaseName: string | undefined,
  category: HealthDocumentCategory,
): string {
  const head = rawText.slice(0, 1200);
  for (const { re, title } of TITLE_PATTERNS) {
    if (re.test(head)) return title;
  }
  const base = (fileBaseName ?? "").replace(/\.[a-z0-9]+$/i, "").trim();
  if (base.length >= 3) return base.slice(0, 200);
  if (category === "ANALYSIS") return "Лабораторный документ";
  if (category === "DISCHARGE_SUMMARY") return "Выписка";
  return "Документ";
}

export type ExtractedHealthDocMetadata = {
  title: string;
  category: HealthDocumentCategory;
  documentDateISO: string | null;
};

export function extractMetadataFromPlainText(
  rawText: string,
  opts?: { fileBaseName?: string },
): ExtractedHealthDocMetadata {
  const text = rawText.replace(/\r\n/g, "\n");
  const lower = text.slice(0, TEXT_WINDOW).toLowerCase();
  const documentDateISO = extractBestDocumentDate(text);
  const category = inferCategory(lower);
  const title = inferTitle(lower, text, opts?.fileBaseName, category);
  return { title, category, documentDateISO };
}

/**
 * Если в тексте явно встречается ФИО другого члена семьи — подсказка для UI.
 */
export function findMentionedFamilyProfile(
  rawText: string,
  profiles: { id: string; displayName: string }[],
): { id: string; displayName: string } | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ")
      .trim();
  const hay = norm(rawText.slice(0, 12_000));
  let best: { id: string; displayName: string; len: number } | null = null;
  for (const p of profiles) {
    const n = norm(p.displayName);
    if (n.length < 5) continue;
    if (hay.includes(n)) {
      if (!best || n.length > best.len) best = { ...p, len: n.length };
    }
  }
  return best ? { id: best.id, displayName: best.displayName } : null;
}
