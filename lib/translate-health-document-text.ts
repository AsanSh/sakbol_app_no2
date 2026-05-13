import "server-only";

import {
  deepseekChatCompletion,
  deepseekEnabled,
  deepseekModelFast,
  deepseekTranslateTimeoutMs,
} from "@/lib/deepseek";

export type DocTranslateTargetLang = "ru" | "en" | "hi";

const LANG_NAMES: Record<DocTranslateTargetLang, string> = {
  ru: "Russian (Русский)",
  en: "English",
  hi: "Hindi in Devanagari script (हिन्दी)",
};

const MAX_INPUT_CHUNK = 14_000;

function splitForTranslation(text: string): string[] {
  const t = text.trim();
  if (t.length <= MAX_INPUT_CHUNK) return [t];
  const chunks: string[] = [];
  let rest = t;
  while (rest.length > 0) {
    if (rest.length <= MAX_INPUT_CHUNK) {
      chunks.push(rest);
      break;
    }
    let slice = rest.slice(0, MAX_INPUT_CHUNK);
    const breakAt = Math.max(
      slice.lastIndexOf("\n\n"),
      slice.lastIndexOf("\n"),
      slice.lastIndexOf(". "),
    );
    if (breakAt > 2000) {
      slice = rest.slice(0, breakAt + 1);
    }
    chunks.push(slice.trimEnd());
    rest = rest.slice(slice.length).trimStart();
  }
  return chunks;
}

/**
 * Перевод распознанного текста медицинского документа; сохраняем абзацы и списки.
 * DeepSeek «быстрая» модель (`deepseek-v4-flash` по умолчанию, см. DEEPSEEK_MODEL_FAST).
 */
export async function translateHealthDocumentPlainText(
  plainText: string,
  target: DocTranslateTargetLang,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!deepseekEnabled()) {
    return {
      ok: false,
      error: "Перевод недоступен: задайте DEEPSEEK_API_KEY на сервере.",
    };
  }
  const trimmed = plainText.replace(/\0/g, "").trim();
  if (!trimmed) {
    return { ok: false, error: "Нет извлекаемого текста для перевода." };
  }

  const system = `You are a professional medical document translator.
Translate the user's text into ${LANG_NAMES[target]}.
Rules:
- Preserve structure: paragraph breaks (blank lines), numbered/bullet lists, and approximate column alignment in plain text.
- Do not add explanations or preambles — output ONLY the translated document text.
- Keep medication names, lab units, and values accurate; transliterate drug names to the target script when standard.
- For Hindi (hi), use Unicode Devanagari (हिन्दी).`;

  const parts = splitForTranslation(trimmed);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    const header =
      parts.length > 1
        ? `[Part ${i + 1} of ${parts.length} — translate completely, keep delimiters as in original]\n\n`
        : "";
    const userContent = `${header}${chunk}`;

    const res = await deepseekChatCompletion({
      model: deepseekModelFast(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      maxTokens: 8192,
      temperature: 0.15,
      timeoutMs: deepseekTranslateTimeoutMs(),
    });
    if (!res.ok) {
      return { ok: false, error: res.userMessage || "Ошибка перевода." };
    }
    out.push(res.text.trim());
  }

  return { ok: true, text: out.join("\n\n") };
}
