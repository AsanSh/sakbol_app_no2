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

const HEAD_SCAN = 18_000;
const TAIL_SCAN = 14_000;
const BODY_MAX = 220_000;
const OCR_SEP = "[./\\\\-\\u2012\\u2013\\u2014\\u2212\\s]{0,3}";

/** Бонус, если рядом с цифрами есть типичные мед. формулировки (не имя файла). */
function scoreNearbyMedicalContext(fullLower: string, globalIndex: number): number {
  const start = Math.max(0, globalIndex - 72);
  const frag = fullLower.slice(start, globalIndex + 48);
  let s = 0;
  if (
    /дата\s*(?:осмотра|исследования|поступления|операции|приёма|приема|забора|взятия|пробы|назначения|выдачи|выписки|документа|результата|регистрации|заключения|направления|выполнения|анализа)/.test(
      frag,
    )
  )
    s += 14;
  if (/дата\s*:/.test(frag)) s += 10;
  if (/от\s*\d{1,2}[./]\d{1,2}[./]\d{4}/.test(frag)) s += 5;
  if (/исследован|результат|бланк|лаборатор|биоматериал|заключение|пациент/i.test(frag)) s += 4;
  return s;
}

/** Штраф за «голую» дату в самом начале текста без слова «дата» (часто шапка/ФИО/имя файла). */
function unlabeledLeadingMalus(fullLower: string, globalIndex: number): number {
  const start = Math.max(0, globalIndex - 48);
  const frag = fullLower.slice(start, globalIndex + 8);
  const hasDateWord = /дата|date\b/i.test(frag);
  if (hasDateWord) return 0;
  if (globalIndex < 100) return -35;
  if (globalIndex < 420) return -20;
  return 0;
}

/**
 * Явные подписи «дата …» + дата на той же или следующей строке (ДД.ММ.ГГГГ / ГГГГ-ММ-ДД).
 * Только текст тела документа — не имя файла (имя не передаётся в rawText).
 */
const LABELED_DMY_PATTERNS: Array<{ re: RegExp; bonus: number }> = [
  {
    re: /дата\s+осмотра\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 48,
  },
  {
    re: /дата\s+исследования\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 48,
  },
  {
    re: /дата\s+поступления(?:\s+биоматериала)?\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 48,
  },
  {
    re: /дата\s+операции\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 48,
  },
  {
    re: /дата\s+(?:приёма|приема)\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 48,
  },
  {
    re: /дата\s+взятия\s+(?:образца|биоматериала|пробы|крови)\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 50,
  },
  {
    re: /дата\s+забора(?:\s+биоматериала|\s+пробы)?\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 50,
  },
  {
    re: /дата\s+пробы\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 48,
  },
  {
    re: /дата\s+назначения\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 44,
  },
  {
    re: /дата\s+выдачи\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 44,
  },
  {
    re: /дата\s+выписки\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 44,
  },
  {
    re: /дата\s+регистрации\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 42,
  },
  {
    re: /дата\s+заключения\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 42,
  },
  {
    re: /дата\s+направления\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 42,
  },
  {
    re: /дата\s+выполнения\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 46,
  },
  {
    re: /дата\s+анализа\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 46,
  },
  {
    re: /дата\s+документа\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 40,
  },
  {
    re: /дата\s+результата\s*(?:\n\s*)?[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 44,
  },
  /** Строка вида «Дата: 01.02.2024» или «Дата 01.02.2024». */
  {
    re: /(?:^|[\n\r])\s*дата\s*[:\s]\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 38,
  },
  /** Обобщённый хвост после слова «дата». */
  {
    re: /дата\s*(?:забора|анализа|исследования|выписки|документа|пробы|назначения|результата)?\s*[:\s.-]*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/gi,
    bonus: 28,
  },
];

const LABELED_YMD_PATTERNS: Array<{ re: RegExp; bonus: number }> = [
  {
    re: /дата\s+осмотра\s*(?:\n\s*)?[:\s.-]*(\d{4})-(\d{2})-(\d{2})/gi,
    bonus: 48,
  },
  {
    re: /дата\s+исследования\s*(?:\n\s*)?[:\s.-]*(\d{4})-(\d{2})-(\d{2})/gi,
    bonus: 48,
  },
  {
    re: /дата\s+забора\s*(?:\n\s*)?[:\s.-]*(\d{4})-(\d{2})-(\d{2})/gi,
    bonus: 50,
  },
  {
    re: /(?:^|[\n\r])\s*дата\s*[:\s]\s*(\d{4})-(\d{2})-(\d{2})/gi,
    bonus: 38,
  },
];

/** OCR-friendly даты с пробелами/необычными тире между цифрами. */
const OCR_DMY_RE = new RegExp(
  `\\b(\\d{1,2})${OCR_SEP}(\\d{1,2})${OCR_SEP}(\\d{4})\\b`,
  "g",
);
const OCR_YMD_RE = new RegExp(
  `\\b(\\d{4})${OCR_SEP}(\\d{1,2})${OCR_SEP}(\\d{1,2})\\b`,
  "g",
);

const MONTHS_RU: Record<string, number> = {
  января: 1,
  январь: 1,
  феврал: 2,
  марта: 3,
  март: 3,
  апреля: 4,
  апрел: 4,
  мая: 5,
  май: 5,
  июня: 6,
  июн: 6,
  июля: 7,
  июл: 7,
  августа: 8,
  август: 8,
  сентября: 9,
  сентябр: 9,
  октября: 10,
  октябр: 10,
  ноября: 11,
  ноябр: 11,
  декабря: 12,
  декабр: 12,
};

function parseOcrDigits(token: string): number | null {
  const norm = token
    .replace(/[OoОо]/g, "0")
    .replace(/[I|lІ]/g, "1")
    .replace(/[SЅ]/g, "5")
    .replace(/[BВ]/g, "8")
    .replace(/[Zz]/g, "2")
    .replace(/[^\d]/g, "");
  if (!norm) return null;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ищет даты в теле файла: приоритет подписей «дата осмотра/забора/…», затем цифры в начале и конце документа.
 */
export function extractBestDocumentDate(rawText: string): string | null {
  const text = rawText.replace(/\r\n/g, "\n").trim();
  if (!text) return null;

  const body = text.length > BODY_MAX ? text.slice(0, BODY_MAX) : text;
  const fullLower = text.toLowerCase();
  const candidates: ScoredDate[] = [];

  const pushDmy = (y: number, mo: number, d: number, globalIndex: number, bonus: number) => {
    const ymd = toYmd(y, mo, d);
    if (!ymd) return;
    const yearNow = new Date().getFullYear();
    if (y < 1990 || y > yearNow + 1) return;
    const ctx = scoreNearbyMedicalContext(fullLower, globalIndex);
    const malus = bonus >= 28 ? 0 : unlabeledLeadingMalus(fullLower, globalIndex);
    candidates.push({
      ymd,
      score: bonus + ctx + malus,
      index: globalIndex,
    });
  };

  const collectFromSlice = (slice: string, baseOffset: number) => {
    for (const { re, bonus } of LABELED_DMY_PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(slice)) !== null) {
        pushDmy(Number(m[3]), Number(m[2]), Number(m[1]), baseOffset + m.index, bonus);
      }
    }
    for (const { re, bonus } of LABELED_YMD_PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(slice)) !== null) {
        pushDmy(Number(m[1]), Number(m[2]), Number(m[3]), baseOffset + m.index, bonus);
      }
    }

    const reDmy = /\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g;
    let m: RegExpExecArray | null;
    while ((m = reDmy.exec(slice)) !== null) {
      pushDmy(Number(m[3]), Number(m[2]), Number(m[1]), baseOffset + m.index, 6);
    }

    const reYmd = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
    while ((m = reYmd.exec(slice)) !== null) {
      pushDmy(Number(m[1]), Number(m[2]), Number(m[3]), baseOffset + m.index, 8);
    }

    const reSlashIso = /\b(\d{4})[./](\d{1,2})[./](\d{1,2})\b/g;
    while ((m = reSlashIso.exec(slice)) !== null) {
      pushDmy(Number(m[1]), Number(m[2]), Number(m[3]), baseOffset + m.index, 7);
    }

    OCR_DMY_RE.lastIndex = 0;
    while ((m = OCR_DMY_RE.exec(slice)) !== null) {
      pushDmy(Number(m[3]), Number(m[2]), Number(m[1]), baseOffset + m.index, 6);
    }

    OCR_YMD_RE.lastIndex = 0;
    while ((m = OCR_YMD_RE.exec(slice)) !== null) {
      pushDmy(Number(m[1]), Number(m[2]), Number(m[3]), baseOffset + m.index, 7);
    }

    // OCR-шум: 2O.O1.2O24, I2-03-2024 и т.п.
    const noisyDmyRe =
      /\b([0-9OОoоI|lІSЅBВZz]{1,2})[^0-9A-Za-zА-Яа-я]{0,3}([0-9OОoоI|lІSЅBВZz]{1,2})[^0-9A-Za-zА-Яа-я]{0,3}([0-9OОoоI|lІSЅBВZz]{4})\b/g;
    while ((m = noisyDmyRe.exec(slice)) !== null) {
      const d = parseOcrDigits(m[1]);
      const mo = parseOcrDigits(m[2]);
      const y = parseOcrDigits(m[3]);
      if (d != null && mo != null && y != null) {
        pushDmy(y, mo, d, baseOffset + m.index, 9);
      }
    }

    // Формат "12 марта 2024" / "дата осмотра 7 апр 2023".
    const monthWordsRe =
      /\b(\d{1,2})\s+(январ[ья]|феврал[ья]|март[а]?|апрел[ья]|ма[йя]|июн[ья]?|июл[ья]?|август[а]?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])\s+(\d{4})\b/gi;
    while ((m = monthWordsRe.exec(slice)) !== null) {
      const d = Number(m[1]);
      const y = Number(m[3]);
      const key = m[2].toLowerCase();
      const mo =
        MONTHS_RU[key] ??
        Object.entries(MONTHS_RU).find(([k]) => key.startsWith(k))?.[1] ??
        null;
      if (mo != null) {
        pushDmy(y, mo, d, baseOffset + m.index, 14);
      }
    }
  };

  const head = body.slice(0, Math.min(HEAD_SCAN, body.length));
  collectFromSlice(head, 0);

  if (text.length > HEAD_SCAN + 400) {
    const tail = text.slice(-Math.min(TAIL_SCAN, text.length));
    collectFromSlice(tail, text.length - tail.length);
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0]?.ymd ?? null;
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
  const looksLikeDateOnly = /^\d{1,2}[._-]\d{1,2}[._-]\d{2,4}$/.test(base);
  if (base.length >= 3 && !looksLikeDateOnly) return base.slice(0, 200);
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
