import "server-only";

import type { ParsedBiomarker } from "@/types/biomarker";

/** Расширенный ответ для Smart Upload: дата бланка, лаборатория, строки таблицы. */
export type LabOcrDraft = {
  biomarkers: ParsedBiomarker[];
  /** ISO date (YYYY-MM-DD) */
  analysisDate?: string;
  labName?: string;
};

export const LLM_BIOMARKER_SYSTEM = `Сен лабораториялык баяндамаларды структуралаган жардамчысың. Берилген текст же сүрөт боюнча кан анализинин маалыматтарын чыгар.
Кайтаруу: гана жарактуу JSON объект, башка текст жок.
Формат: {"analysisDate": "YYYY-MM-DD" (бланктагы дата; табылбаса бош строка), "labName": "лаборатория же клиниканын аталышы (табылбаса бош)", "biomarkers": [{"biomarker": string, "value": number, "unit": string, "reference": string}, ...]}.
Эреже: оорулуунун аты-жөнү, дареги, ИНН, паспорт, телефон сыяктуу жеке маалыматтарды эч качан кошпо.
Эгер сан чекит менен болсо, value үчүн JSON number колдон (мисалы 5.8).
Эски формат (бир гана массив) да колдоого алынат — анда analysisDate жана labName бош деп эсептелет.`;

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
  if (out.length === 0) throw new Error("No biomarkers in LLM output");
  return out;
}

/** Парсит JSON модели: объект Smart Upload же legacy-массив. */
export function labDraftFromLlmJsonText(text: string): LabOcrDraft {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;
  if (Array.isArray(parsed)) {
    return { biomarkers: biomarkersFromRows(parsed) };
  }
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    let rows: unknown[] | null = null;
    if (Array.isArray(o.biomarkers)) rows = o.biomarkers;
    else if (Array.isArray(o.items)) rows = o.items;
    if (!rows) throw new Error("LLM JSON must be an array or { biomarkers: [...] }");
    const analysisDate =
      normalizeOptionalIsoDate(o.analysisDate) ??
      normalizeOptionalIsoDate(o.date) ??
      normalizeOptionalIsoDate(o.labDate);
    const labNameRaw = o.labName ?? o.title ?? o.name;
    const labName =
      typeof labNameRaw === "string" && labNameRaw.trim() ? labNameRaw.trim() : undefined;
    return {
      biomarkers: biomarkersFromRows(rows),
      ...(analysisDate ? { analysisDate } : {}),
      ...(labName ? { labName } : {}),
    };
  }
  throw new Error("LLM returned invalid JSON");
}

/**
 * Имена моделей для AI Studio REST (без префикса models/).
 * Порядок: сначала актуальные flash, затем стабильные версии с суффиксами.
 */
function geminiModelCandidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  const fallbacks = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-8b",
    "gemini-1.5-flash",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro",
    "gemini-1.5-pro-002",
  ];
  const raw = (fromEnv ? [fromEnv, ...fallbacks] : fallbacks).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of raw) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

/** Следующая модель из списка — только при «модель не найдена» (часто 404 на v1beta). */
function shouldTryNextGeminiModel(errMsg: string): boolean {
  return /(^|\s)404(\s|:)|\bNOT_FOUND\b|is not found for API version|not supported for generateContent/i.test(
    errMsg,
  );
}

/** Короткое сообщение в модалку загрузки (без простыни JSON). */
function humanizeGeminiFailureForUser(raw: string): string {
  const t = raw.trim();
  if (/\b429\b|quota|Quota exceeded|exceeded your current quota|rate limit|RESOURCE_EXHAUSTED/i.test(t)) {
    return [
      "Квота Gemini исчерпана или для ключа не включён доступ к API (часто «limit: 0» на бесплатном плане).",
      "Откройте Google AI Studio → проверьте биллинг и лимиты, подождите минуту и повторите.",
      "Документация: https://ai.google.dev/gemini-api/docs/rate-limits",
    ].join(" ");
  }
  if (/\b403\b|PERMISSION_DENIED/i.test(t)) {
    return "Доступ к Gemini запрещён (403). Проверьте ключ в AI Studio и включённый Generative Language API для проекта.";
  }
  if (/\b400\b|API key not valid|API_KEY_INVALID|invalid API key/i.test(t)) {
    return "Ключ GEMINI_API_KEY недействителен. Создайте новый в Google AI Studio и обновите переменную на сервере.";
  }
  if (/\b404\b|NOT_FOUND|is not found for API version|ни одна модель не подошла/i.test(t)) {
    return [
      "Ни одна из встроенных моделей Gemini не ответила для вашего ключа (404 или нет доступа).",
      "Откройте Google AI Studio → раздел моделей, скопируйте точное имя (например gemini-2.5-flash) и задайте GEMINI_MODEL в .env / Vercel.",
      "Список: https://ai.google.dev/gemini-api/docs/models",
    ].join(" ");
  }
  return `Не удалось разобрать файл через Gemini. ${t.slice(0, 280)}${t.length > 280 ? "…" : ""}`;
}

const GEMINI_API_VERSIONS = ["v1beta", "v1"] as const;

async function generateContentWithGeminiModel(
  model: string,
  buffer: Buffer,
  mimeType: string,
  key: string,
  apiVersion: (typeof GEMINI_API_VERSIONS)[number],
): Promise<LabOcrDraft> {
  const b64 = buffer.toString("base64");
  const userPrompt =
    "Чыгарып бер: гана JSON — объект { analysisDate, labName, biomarkers } (көрсөткүчтөрдүн тизмеси), башка текст жок.";

  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: LLM_BIOMARKER_SYSTEM }] },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }, { inlineData: { mimeType, data: b64 } }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini ${res.status} [${apiVersion}/${model}]: ${bodyText.slice(0, 400)}`);
  }

  const json = JSON.parse(bodyText) as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
    promptFeedback?: { blockReason?: string };
  };
  if (json.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked: ${json.promptFeedback.blockReason}`);
  }
  if (!json.candidates?.length) throw new Error("Gemini: empty candidates");
  const cand = json.candidates[0];
  const fr = cand?.finishReason;
  if (fr && fr !== "STOP" && fr !== "MAX_TOKENS") {
    throw new Error(`Gemini finish: ${fr}`);
  }
  const text =
    cand?.content?.parts?.map((part) => part.text ?? "").join("")?.trim() ?? "";
  if (!text) throw new Error("Empty Gemini response");
  return labDraftFromLlmJsonText(text);
}

/** Google AI Studio / Gemini API: изображения и PDF (inline). */
async function parseWithGemini(buffer: Buffer, mimeType: string): Promise<LabOcrDraft> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("No Gemini API key");

  const models = geminiModelCandidates();
  let lastErr = "";
  for (const model of models) {
    for (const apiVersion of GEMINI_API_VERSIONS) {
      try {
        return await generateContentWithGeminiModel(model, buffer, mimeType, key, apiVersion);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        lastErr = msg;
        if (shouldTryNextGeminiModel(msg)) {
          continue;
        }
        throw e;
      }
    }
  }
  throw new Error(
    `Gemini: ни одна модель не подошла (${models.join(", ")}; пробовали API v1beta и v1). Последняя ошибка: ${lastErr.slice(0, 320)}`,
  );
}

function openaiLabOcrModel(): string {
  return process.env.OPENAI_LAB_OCR_MODEL?.trim() || "gpt-4o-mini";
}

async function parseWithOpenAIVision(
  buffer: Buffer,
  mimeType: string,
): Promise<LabOcrDraft> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("No API key");

  const b64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${b64}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openaiLabOcrModel(),
      temperature: 0.1,
      messages: [
        { role: "system", content: LLM_BIOMARKER_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Чыгарып бер: JSON объект { analysisDate, labName, biomarkers } гана.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  return labDraftFromLlmJsonText(text);
}

/**
 * OCR/LLM извлечения показателей:
 * - PDF: только Gemini ( vision PDF inline ), если задан GEMINI_API_KEY.
 * - Фото: GPT-4o mini через OpenAI Vision (`OPENAI_LAB_OCR_MODEL`, по умолчанию gpt-4o-mini) и/или Gemini.
 * - `LAB_OCR_PREFER_OPENAI=1` — для фото сначала OpenAI, при ошибке — Gemini (если ключ есть).
 * - Иначе порядок: сначала Gemini (если есть ключ), при ошибке на фото — OpenAI.
 * Мок только при ALLOW_MOCK_LAB_PARSER=1.
 */
export async function processMedicalDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<{
  biomarkers: ParsedBiomarker[];
  analysisDate?: string;
  labName?: string;
  parser: "gemini" | "openai" | "mock";
}> {
  const hasGemini = !!process.env.GEMINI_API_KEY?.trim();
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.trim();
  const isImage = mimeType.startsWith("image/");
  const canGemini =
    hasGemini && (isImage || mimeType === "application/pdf");
  const canOpenAIVision = isImage && hasOpenAI;

  const preferOpenAI =
    process.env.LAB_OCR_PREFER_OPENAI?.trim().toLowerCase() === "1" ||
    process.env.LAB_OCR_PREFER_OPENAI?.trim().toLowerCase() === "true" ||
    process.env.LAB_OCR_PREFER_OPENAI?.trim().toLowerCase() === "yes";

  const fromDraft = (
    draft: LabOcrDraft,
    parser: "gemini" | "openai",
  ): {
    biomarkers: ParsedBiomarker[];
    analysisDate?: string;
    labName?: string;
    parser: "gemini" | "openai";
  } => ({
    biomarkers: draft.biomarkers,
    analysisDate: draft.analysisDate,
    labName: draft.labName,
    parser,
  });

  async function tryGemini(): Promise<LabOcrDraft> {
    return parseWithGemini(buffer, mimeType);
  }

  async function tryOpenAI(): Promise<LabOcrDraft> {
    return parseWithOpenAIVision(buffer, mimeType);
  }

  /** Сценарий: только изображения — выбор порядка OpenAI / Gemini. */
  if (isImage && (canOpenAIVision || canGemini)) {
    if (preferOpenAI && canOpenAIVision) {
      try {
        return fromDraft(await tryOpenAI(), "openai");
      } catch (openErr) {
        const omsg = openErr instanceof Error ? openErr.message : String(openErr);
        console.error("[processMedicalDocument] OpenAI (preferred):", omsg);
        if (canGemini) {
          try {
            return fromDraft(await tryGemini(), "gemini");
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("[processMedicalDocument] Gemini fallback:", msg);
            throw new Error(humanizeGeminiFailureForUser(msg));
          }
        }
        throw new Error(`OpenAI Vision: ${omsg}`);
      }
    }

    if (canGemini) {
      try {
        return fromDraft(await tryGemini(), "gemini");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[processMedicalDocument] Gemini:", msg);
        if (canOpenAIVision) {
          try {
            return fromDraft(await tryOpenAI(), "openai");
          } catch (openErr) {
            const omsg = openErr instanceof Error ? openErr.message : String(openErr);
            console.error("[processMedicalDocument] OpenAI fallback:", omsg);
            throw new Error(humanizeGeminiFailureForUser(msg));
          }
        }
        throw new Error(humanizeGeminiFailureForUser(msg));
      }
    }

    if (canOpenAIVision) {
      try {
        return fromDraft(await tryOpenAI(), "openai");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[processMedicalDocument] OpenAI:", msg);
        throw new Error(`OpenAI Vision: ${msg}`);
      }
    }
  }

  /** PDF — только Gemini. */
  if (mimeType === "application/pdf" && canGemini) {
    try {
      return fromDraft(await tryGemini(), "gemini");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[processMedicalDocument] Gemini:", msg);
      throw new Error(humanizeGeminiFailureForUser(msg));
    }
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

  if (!hasGemini && !hasOpenAI) {
    throw new Error(
      "Не задан GEMINI_API_KEY (или OPENAI_API_KEY для фото). Добавьте ключ в .env на сервере и перезапустите.",
    );
  }

  if (hasGemini && !mimeType.startsWith("image/") && mimeType !== "application/pdf") {
    throw new Error("Поддерживаются только PDF или изображение (PNG, JPG, WEBP).");
  }

  throw new Error(
    "Для PDF нужен GEMINI_API_KEY. Для этого типа файла распознавание недоступно.",
  );
}
