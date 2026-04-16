import "server-only";

import type { ParsedBiomarker } from "@/types/biomarker";

export const LLM_BIOMARKER_SYSTEM = `Сен лабораториялык баяндамаларды структуралаган жардамчысың. Берилген текст же сүрөттөгү окуя боюнча кан анализинин көрсөткүчтөрүн чыгар.
Кайтаруу: гана жарактуу JSON массиви, башка текст жок. Ар бир элемент: {"biomarker": string, "value": number, "unit": string, "reference": string}.
Эреже: оорулуунун аты-жөнү, дареги, ИНН, паспорт, телефон сыяктуу жеке маалыматтарды эч качан кошпо.
Эгер сан чекит менен болсо, value үчүн JSON number колдон (мисалы 5.8).`;

function allowMockLabParser(): boolean {
  const v = process.env.ALLOW_MOCK_LAB_PARSER?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Только при ALLOW_MOCK_LAB_PARSER=1 (локальные тесты без API). */
export function mockBiomarkers(): ParsedBiomarker[] {
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

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function biomarkersFromLlmJsonText(text: string): ParsedBiomarker[] {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;
  let rows: unknown[];
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.biomarkers)) rows = o.biomarkers;
    else if (Array.isArray(o.items)) rows = o.items;
    else throw new Error("LLM JSON must be an array or { biomarkers: [...] }");
  } else {
    throw new Error("LLM returned invalid JSON");
  }

  const out: ParsedBiomarker[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const biomarker = String(r.biomarker ?? "").trim();
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

/** Имена моделей для AI Studio REST v1beta (без префикса models/). */
function geminiModelCandidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  const fallbacks = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
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

async function generateContentWithGeminiModel(
  model: string,
  buffer: Buffer,
  mimeType: string,
  key: string,
): Promise<ParsedBiomarker[]> {
  const b64 = buffer.toString("base64");
  const userPrompt =
    "Чыгарып бер: лабораториялык көрсөткүчтөрдүн JSON массиви гана, башка текст жок.";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
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
    throw new Error(`Gemini ${res.status} (${model}): ${bodyText.slice(0, 400)}`);
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
  return biomarkersFromLlmJsonText(text);
}

/** Google AI Studio / Gemini API: изображения и PDF (inline). */
async function parseWithGemini(buffer: Buffer, mimeType: string): Promise<ParsedBiomarker[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("No Gemini API key");

  const models = geminiModelCandidates();
  let lastErr = "";
  for (const model of models) {
    try {
      return await generateContentWithGeminiModel(model, buffer, mimeType, key);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastErr = msg;
      if (shouldTryNextGeminiModel(msg)) {
        continue;
      }
      throw e;
    }
  }
  throw new Error(
    `Gemini: ни одна модель не подошла (${models.join(", ")}). Последняя ошибка: ${lastErr.slice(0, 280)}`,
  );
}

async function parseWithOpenAIVision(
  buffer: Buffer,
  mimeType: string,
): Promise<ParsedBiomarker[]> {
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
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: LLM_BIOMARKER_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Чыгарып бер: көрсөткүчтөрдүн JSON массиви гана (кыска).",
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
  return biomarkersFromLlmJsonText(text);
}

/**
 * OCR/LLM: при `GEMINI_API_KEY` — Gemini (сүрөт + PDF); иначе сүрөттөр үчүн OpenAI.
 * Случайный «демо»-набор больше не подставляется: при ошибке API — исключение.
 * Мок только если явно ALLOW_MOCK_LAB_PARSER=1.
 */
export async function processMedicalDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<{ biomarkers: ParsedBiomarker[]; parser: "gemini" | "openai" | "mock" }> {
  const hasGemini = !!process.env.GEMINI_API_KEY?.trim();
  const canGemini =
    hasGemini &&
    (mimeType.startsWith("image/") || mimeType === "application/pdf");

  if (canGemini) {
    try {
      const biomarkers = await parseWithGemini(buffer, mimeType);
      return { biomarkers, parser: "gemini" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[processMedicalDocument] Gemini:", msg);
      throw new Error(
        `Gemini не смог разобрать файл. Проверьте GEMINI_API_KEY и GEMINI_MODEL на сервере. ${msg}`,
      );
    }
  }

  const canOpenAIVision = mimeType.startsWith("image/") && !!process.env.OPENAI_API_KEY?.trim();
  if (canOpenAIVision) {
    try {
      const biomarkers = await parseWithOpenAIVision(buffer, mimeType);
      return { biomarkers, parser: "openai" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[processMedicalDocument] OpenAI:", msg);
      throw new Error(`OpenAI Vision: ${msg}`);
    }
  }

  if (allowMockLabParser()) {
    await sleep(500);
    return { biomarkers: mockBiomarkers(), parser: "mock" };
  }

  if (!hasGemini && !process.env.OPENAI_API_KEY?.trim()) {
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
