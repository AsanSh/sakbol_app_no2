import "server-only";

import Groq from "groq-sdk";

const VISION_MODEL =
  process.env.GROQ_VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";
const TEXT_MODEL = process.env.GROQ_TEXT_MODEL ?? "llama-3.3-70b-versatile";

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY not set");
  return new Groq({ apiKey });
}

function buildMedicalSystemPrompt(targetLanguage: string): string {
  return `You are the leading medical AI expert of the Sakbol system. Before you is a scan of a medical document.

Your task is to perform a comprehensive analysis in a single pass:

1. OCR Extraction: Locate and recognize all key data.
   - If it is a Complete Blood Count (CBC/ОАК): extract hematocrit, erythrocytes, hemoglobin, leukocytes, platelets with deviation markers (↑/↓).
   - If it is a biochemistry or thyroid panel: find TSH, T3, T4, antibody titers, glucose, lipid profile — note critical deviations.
   - If it is a medical protocol/discharge summary (ЮРФА): find diagnoses, complaints, surgical history, prescribed medications and dosages.

2. Clinical Reasoning: Correlate the data points with each other.
   - Explain how diagnoses, surgical history, and lab deviations are interconnected.
   - Highlight critical values (e.g. TSH < 0.1 after thyroidectomy on L-thyroxine = requires endocrinologist).
   - Connect anemia markers to underlying conditions (e.g. bowel resection → malabsorption → iron/B12 deficiency).

3. Localization and Translation: Generate the final structured report in the language: ${targetLanguage}.
   Use clear, patient-friendly language without medical fear-mongering, but retain strict regional medical terminology.

Output format — structured report with sections:
## Summary
## Key Findings
## Clinical Correlations
## Recommendations

Important: Do not diagnose or prescribe. Always recommend consulting the treating physician for clinical decisions.`;
}

/**
 * Анализ медицинского изображения / PDF-страницы через Groq Llama 4 Scout (vision).
 * Возвращает AsyncGenerator с чанками текста для стриминга.
 */
export async function* analyzeMedicalImage(
  base64: string,
  mimeType: string,
  targetLanguage: string,
): AsyncGenerator<string> {
  const client = getClient();
  const systemPrompt = buildMedicalSystemPrompt(targetLanguage);

  const stream = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: systemPrompt },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    stream: true,
    temperature: 0.35,
    max_tokens: 4096,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

/**
 * Текстовый Q&A через Groq (без vision) — для вкладки «ИИ» (чат по анализам).
 */
export async function askGroqLabAssistant(
  systemInstruction: string,
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  let client: Groq;
  try {
    client = getClient();
  } catch {
    return { ok: false, userMessage: "NO_KEY" };
  }

  try {
    const completion = await client.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userText },
      ],
      temperature: 0.35,
      max_tokens: 2048,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, userMessage: "Groq вернул пустой ответ. Попробуйте ещё раз." };
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, userMessage: humanizeGroqError(msg) };
  }
}

function humanizeGroqError(raw: string): string {
  const t = raw.trim();
  if (/429|rate.?limit|quota/i.test(t))
    return "Groq: превышен лимит запросов. Подождите немного и повторите.";
  if (/401|invalid.*key|api.?key/i.test(t))
    return "Groq: неверный API-ключ. Проверьте GROQ_API_KEY.";
  if (/403/i.test(t)) return "Groq: доступ запрещён (403). Проверьте ключ и права.";
  return `Groq: ошибка. ${t.slice(0, 220)}${t.length > 220 ? "…" : ""}`;
}
