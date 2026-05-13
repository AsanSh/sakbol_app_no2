import "server-only";

import { deepseekEnabled, deepseekReasoningJson } from "@/lib/deepseek";
import { extractPlainTextFromHealthDocumentBuffer } from "@/lib/health-document-text-extract";
import type { ParsedBiomarker } from "@/types/biomarker";

/** Расширенный ответ для Smart Upload: дата бланка, лаборатория, строки таблицы. */
export type LabOcrDraft = {
  biomarkers: ParsedBiomarker[];
  /** ISO date (YYYY-MM-DD) */
  analysisDate?: string;
  labName?: string;
  /** Тип документа по версии LLM. "lab" — лабораторный анализ; иное — протокол/выписка/прочее. */
  documentType?: string;
};

/** Подсказка для пользователя: загруженный файл — не лабораторный бланк. */
export class NonLabDocumentError extends Error {
  readonly detectedType: string;
  constructor(detectedType: string) {
    super(
      "Файл не похож на лабораторный анализ (это протокол врача, выписка, направление, рецепт или иной документ). Загрузите его в раздел «Документы» — там по нажатию кнопки «Разбор ИИ» нейросеть прочитает документ и кратко расскажет, что назначил врач, к каким специалистам стоит сходить и какие вопросы задать.",
    );
    this.name = "NonLabDocumentError";
    this.detectedType = detectedType;
  }
}

export const LLM_BIOMARKER_SYSTEM = `Ты — экстрактор лабораторных биомаркеров. Твоя задача — извлекать показатели ИСКЛЮЧИТЕЛЬНО из лабораторных бланков (ОАК, ОАМ, биохимия, гормоны, коагулограмма и т.п.), где есть таблица с числовыми значениями.

ВЕРНИ ТОЛЬКО JSON без markdown-обёртки и без текста вокруг. Схема:
{
  "documentType": "lab" | "non-lab",
  "analysisDate": "YYYY-MM-DD" | "",
  "labName": string | "",
  "biomarkers": [
    { "biomarker": string, "value": number, "unit": string, "reference": string }
  ]
}

ЖЁСТКИЕ ПРАВИЛА (нарушать запрещено):
1. Если документ — НЕ лабораторный анализ (протокол приёма врача, выписка, назначение/рецепт, направление, справка, договор, снимок без таблицы), верни ровно:
   {"documentType":"non-lab","analysisDate":"","labName":"","biomarkers":[]}
   Никогда не придумывай таблицу показателей в таком случае.
2. Если документ лабораторный, но числовых значений в таблице не видно — biomarkers: []. НЕ выдумывай числа, единицы и референсы.
3. Извлекай только те строки, где в самом документе явно есть числовое value и единица unit. Не достраивай «типичные» биомаркеры по памяти.
4. value — JSON number (не строка). Десятичный разделитель — точка (5.8, не 5,8).
5. Никогда не включай ФИО, ИНН/ПИН, паспортные данные, телефон, адрес.
6. Сохраняй язык бланка (русский / кыргызский / казахский) — не переводи названия показателей и единицы.
7. Никаких пояснений, дисклеймеров, текста вокруг JSON.`;

function allowMockLabParser(): boolean {
  const v = process.env.ALLOW_MOCK_LAB_PARSER?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Только при ALLOW_MOCK_LAB_PARSER=1 (локальные тесты без API). */
export function mockLabDraft(): LabOcrDraft {
  const biomarkers = mockBiomarkersInner();
  return {
    biomarkers,
    analysisDate: new Date().toISOString().slice(0, 10),
    labName: "Демо-лаборатория",
  };
}

function mockBiomarkersInner(): ParsedBiomarker[] {
  const hb: ParsedBiomarker = {
    biomarker: "Гемоглобин",
    value: 120 + Math.floor(Math.random() * 35),
    unit: "г/л",
    reference: "120–160",
  };
  const vitD: ParsedBiomarker = {
    biomarker: "Витамин D (25-OH)",
    value: 22 + Math.floor(Math.random() * 48),
    unit: "нг/мл",
    reference: "30–100",
  };

  const pool: ParsedBiomarker[] = [
    {
      biomarker: "Глюкоза",
      value: 4.8 + Math.round(Math.random() * 20) / 10,
      unit: "ммоль/л",
      reference: "3.3–5.5",
    },
    {
      biomarker: "Лейкоциттер",
      value: 6.8,
      unit: "10^9/л",
      reference: "4.0–9.0",
    },
    {
      biomarker: "Тромбоциттер",
      value: 245,
      unit: "10^9/л",
      reference: "150–400",
    },
    {
      biomarker: "Креатинин",
      value: 88,
      unit: "мкмоль/л",
      reference: "62–106",
    },
    {
      biomarker: "Холестерин",
      value: 4.8 + Math.round(Math.random() * 15) / 10,
      unit: "ммоль/л",
      reference: "3.0–5.2",
    },
    {
      biomarker: "ЛПВП",
      value: 1.0 + Math.round(Math.random() * 8) / 10,
      unit: "ммоль/л",
      reference: "1.0–2.5",
    },
  ];

  const n = 1 + Math.floor(Math.random() * 2);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, n);
  return [hb, vitD, ...picked];
}

/** @deprecated use mockLabDraft */
export function mockBiomarkers(): ParsedBiomarker[] {
  return mockBiomarkersInner();
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function normalizeOptionalIsoDate(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString().slice(0, 10);
}

function biomarkersFromRows(rows: unknown[]): ParsedBiomarker[] {
  const out: ParsedBiomarker[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const biomarker = String(r.biomarker ?? r.name ?? "").trim();
    const value = Number(r.value);
    if (!biomarker || Number.isNaN(value)) continue;
    out.push({
      biomarker,
      value,
      unit: String(r.unit ?? "").trim(),
      reference: String(r.reference ?? "").trim(),
    });
  }
  return out;
}

const NON_LAB_TYPE_VALUES = new Set([
  "non-lab",
  "non_lab",
  "nonlab",
  "protocol",
  "discharge",
  "discharge_summary",
  "prescription",
  "referral",
  "report",
  "note",
  "other",
]);

function normalizeDocType(raw: unknown): "lab" | "non-lab" | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (v === "lab" || v === "laboratory" || v === "analysis") return "lab";
  if (NON_LAB_TYPE_VALUES.has(v)) return "non-lab";
  return undefined;
}

/**
 * Парсит JSON модели: объект Smart Upload или legacy-массив.
 * Если LLM явно классифицировал документ как НЕ лабораторный (documentType !== "lab")
 * — бросаем NonLabDocumentError, чтобы не подставлять выдуманную таблицу.
 */
export function labDraftFromLlmJsonText(text: string): LabOcrDraft {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;

  if (Array.isArray(parsed)) {
    const biomarkers = biomarkersFromRows(parsed);
    if (biomarkers.length === 0) throw new Error("No biomarkers in LLM output");
    return { biomarkers };
  }

  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    const docType = normalizeDocType(o.documentType ?? o.docType ?? o.type);

    if (docType === "non-lab") {
      const raw = String(o.documentType ?? o.docType ?? o.type ?? "non-lab");
      throw new NonLabDocumentError(raw);
    }

    let rows: unknown[] | null = null;
    if (Array.isArray(o.biomarkers)) rows = o.biomarkers;
    else if (Array.isArray(o.items)) rows = o.items;
    if (!rows) throw new Error("LLM JSON must be an array or { biomarkers: [...] }");

    const biomarkers = biomarkersFromRows(rows);
    if (biomarkers.length === 0) {
      throw new Error("No biomarkers in LLM output");
    }

    const analysisDate =
      normalizeOptionalIsoDate(o.analysisDate) ??
      normalizeOptionalIsoDate(o.date) ??
      normalizeOptionalIsoDate(o.labDate);
    const labNameRaw = o.labName ?? o.title ?? o.name;
    const labName =
      typeof labNameRaw === "string" && labNameRaw.trim() ? labNameRaw.trim() : undefined;
    return {
      biomarkers,
      ...(analysisDate ? { analysisDate } : {}),
      ...(labName ? { labName } : {}),
      ...(docType ? { documentType: docType } : {}),
    };
  }
  throw new Error("LLM returned invalid JSON");
}

const LAB_OCR_USER_PROMPT =
  "Классифицируй документ. Если это лабораторный анализ — извлеки реальные показатели. Если это протокол приёма врача, выписка, назначение, рецепт, направление, справка или иной не-лабораторный документ — верни documentType=\"non-lab\" и пустой массив biomarkers. Никогда не выдумывай показатели. Верни только JSON по схеме из системного промпта.";

/** Минимум символов извлечённого текста (pdf-parse / Poppler+Tesseract / Tesseract на фото). */
const LAB_TEXT_MIN_CHARS = 48;

/**
 * PDF и изображения: локальный текст → DeepSeek accurate (JSON, по умолчанию `deepseek-v4-pro`).
 */
async function parseWithDeepSeek(buffer: Buffer, mimeType: string): Promise<LabOcrDraft> {
  if (!deepseekEnabled()) {
    throw new Error("DEEPSEEK_API_KEY не задан.");
  }
  const plain = await extractPlainTextFromHealthDocumentBuffer(buffer, mimeType);
  const docText = plain.replace(/\u0000/g, "").trim().slice(0, 60_000);
  if (docText.length < LAB_TEXT_MIN_CHARS) {
    if (mimeType === "application/pdf") {
      throw new Error(
        "Не удалось извлечь достаточно текста из PDF для ИИ. Если это скан, на сервере должны быть Poppler и Tesseract; либо загрузите более чёткий скан / экспорт с текстовым слоем.",
      );
    }
    throw new Error(
      "С фото распознано слишком мало текста. Сфотографируйте бланк ровнее, при хорошем свете, или сохраните анализ как PDF.",
    );
  }
  const enriched = `${LAB_OCR_USER_PROMPT}\n\n--- ИЗВЛЕЧЁННЫЙ ТЕКСТ ДОКУМЕНТА ---\n${docText}`;
  const result = await deepseekReasoningJson(LLM_BIOMARKER_SYSTEM, enriched);
  if (!result.ok) {
    throw new Error(`DeepSeek: ${result.userMessage}`);
  }
  return labDraftFromLlmJsonText(result.text);
}

/**
 * OCR/LLM извлечения показателей: только DeepSeek accurate (по умолчанию `deepseek-v4-pro`) по тексту,
 * извлечённому из PDF (pdf-parse, при необходимости Poppler+Tesseract) или с фото (Tesseract).
 * Мок только при ALLOW_MOCK_LAB_PARSER=1.
 */
export async function processMedicalDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<{
  biomarkers: ParsedBiomarker[];
  analysisDate?: string;
  labName?: string;
  parser: "deepseek" | "mock";
}> {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  if (!isImage && !isPdf) {
    throw new Error("Поддерживаются только PDF или изображение (PNG, JPG, WEBP).");
  }

  if (allowMockLabParser()) {
    await sleep(500);
    const d = mockLabDraft();
    return {
      biomarkers: d.biomarkers,
      analysisDate: d.analysisDate,
      labName: d.labName,
      parser: "mock",
    };
  }

  if (!deepseekEnabled()) {
    throw new Error(
      "Распознавание недоступно: задайте DEEPSEEK_API_KEY в .env на сервере и перезапустите приложение.",
    );
  }

  const draft = await parseWithDeepSeek(buffer, mimeType);
  return {
    biomarkers: draft.biomarkers,
    analysisDate: draft.analysisDate,
    labName: draft.labName,
    parser: "deepseek",
  };
}
