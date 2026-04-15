import "server-only";

import type { ParsedBiomarker } from "@/types/biomarker";

export const LLM_BIOMARKER_SYSTEM = `Сен лабораториялык баяндамаларды структуралаган жардамчысың. Берилген текст же сүрөттөгү окуя боюнча кан анализинин көрсөткүчтөрүн чыгар.
Кайтаруу: гана жарактуу JSON массиви, башка текст жок. Ар бир элемент: {"biomarker": string, "value": number, "unit": string, "reference": string}.
Эреже: оорулуунун аты-жөнү, дареги, ИНН, паспорт, телефон сыяктуу жеке маалыматтарды эч качан кошпо.
Эгер сан чекит менен болсо, value үчүн JSON number колдон (мисалы 5.8).`;

/** Синхронный мок для демо-записи без файла (в т.ч. на Vercel). Всегда включает гемоглобин и витамин D. */
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
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned) as unknown;
  if (!Array.isArray(parsed)) throw new Error("LLM returned non-array");
  return parsed.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      biomarker: String(r.biomarker ?? ""),
      value: Number(r.value),
      unit: String(r.unit ?? ""),
      reference: String(r.reference ?? ""),
    };
  });
}

/**
 * OCR/LLM: для изображений — OpenAI при наличии ключа; иначе (и для PDF) — пауза 3 с и мок в БД.
 */
export async function processMedicalDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<{ biomarkers: ParsedBiomarker[]; parser: "openai" | "mock" }> {
  const canVision = mimeType.startsWith("image/") && !!process.env.OPENAI_API_KEY?.trim();

  if (canVision) {
    try {
      const biomarkers = await parseWithOpenAIVision(buffer, mimeType);
      return { biomarkers, parser: "openai" };
    } catch {
      /* fall through */
    }
  }

  await sleep(3000);
  return { biomarkers: mockBiomarkers(), parser: "mock" };
}
