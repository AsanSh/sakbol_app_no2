import "server-only";

/**
 * DeepSeek (https://platform.deepseek.com) — OpenAI-совместимый провайдер.
 * Включается автоматически при наличии DEEPSEEK_API_KEY.
 * Только текстовые запросы: PDF/картинки в API не шлём — текст извлекается локально (pdf-parse, Tesseract).
 *
 * Две модели по умолчанию (скорость vs точность структурированного вывода):
 *   DEEPSEEK_MODEL_ACCURATE — JSON/OCR-разбор, анализ документов, мед. история (по умолчанию `deepseek-v4-pro`)
 *   DEEPSEEK_MODEL_FAST     — лаб-чат, перевод документов по чанкам (по умолчанию `deepseek-v4-flash`)
 *   DEEPSEEK_MODEL          — legacy: как accurate, если не задан DEEPSEEK_MODEL_ACCURATE
 *
 *   DEEPSEEK_TIMEOUT_MS — таймаут в мс (по умолчанию 60000)
 *   DEEPSEEK_TRANSLATE_TIMEOUT_MS — отдельный таймаут для перевода (по умолчанию 120000)
 */

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

const DEEPSEEK_ACCURATE_FALLBACK = "deepseek-v4-pro";
const DEEPSEEK_FAST_FALLBACK = "deepseek-v4-flash";

/** Основная «точная» модель (для обратной совместимости с кодом, ожидающим константу). */
export const DEEPSEEK_DEFAULT_MODEL = DEEPSEEK_ACCURATE_FALLBACK;

export function deepseekEnabled(): boolean {
  return !!process.env.DEEPSEEK_API_KEY?.trim();
}

/** Лабораторный JSON, разбор PDF, динамика / мед. история — максимум точности. */
export function deepseekModelAccurate(): string {
  const a = process.env.DEEPSEEK_MODEL_ACCURATE?.trim();
  if (a) return a;
  const legacy = process.env.DEEPSEEK_MODEL?.trim();
  if (legacy) return legacy;
  return DEEPSEEK_ACCURATE_FALLBACK;
}

/** Чат и перевод по чанкам — ниже задержка и стоимость при хорошем качестве. */
export function deepseekModelFast(): string {
  const f = process.env.DEEPSEEK_MODEL_FAST?.trim();
  if (f) return f;
  return DEEPSEEK_FAST_FALLBACK;
}

/** @deprecated Используйте deepseekModelAccurate() или deepseekModelFast(). */
export function deepseekModel(): string {
  return deepseekModelAccurate();
}

function deepseekTimeoutMs(): number {
  const env = process.env.DEEPSEEK_TIMEOUT_MS?.trim();
  if (env && /^\d+$/.test(env)) return Math.max(2000, Number(env));
  return 60_000;
}

/** Длиннее обычного: перевод больших PDF по слабому каналу до DeepSeek. */
export function deepseekTranslateTimeoutMs(): number {
  const env = process.env.DEEPSEEK_TRANSLATE_TIMEOUT_MS?.trim();
  if (env && /^\d+$/.test(env)) return Math.max(5000, Number(env));
  return 120_000;
}

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function deepseekChatCompletion(params: {
  messages: DeepSeekMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormatJson?: boolean;
  model?: string;
  /** Переопределить DEEPSEEK_TIMEOUT_MS для долгих запросов (перевод документов). */
  timeoutMs?: number;
}): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    return { ok: false, userMessage: "NO_KEY" };
  }

  const model = params.model ?? deepseekModelAccurate();
  const body: Record<string, unknown> = {
    model,
    messages: params.messages,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.2,
  };
  if (params.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  const timeoutMs = params.timeoutMs ?? deepseekTimeoutMs();
  try {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        userMessage: `DeepSeek ${res.status}: ${bodyText.slice(0, 320)}`,
      };
    }
    const json = JSON.parse(bodyText) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (json.error?.message) {
      return { ok: false, userMessage: `DeepSeek error: ${json.error.message}` };
    }
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, userMessage: "DeepSeek: пустой ответ." };
    return { ok: true, text };
  } catch (e) {
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
      return { ok: false, userMessage: `DeepSeek timeout (${timeoutMs} ms)` };
    }
    return {
      ok: false,
      userMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Текстовый chat — для Q&A (лаб-ассистент, общие вопросы). */
export async function deepseekChatText(
  system: string,
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  return deepseekChatCompletion({
    model: deepseekModelFast(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
    maxTokens: 2048,
    temperature: 0.3,
  });
}

/** JSON-режим — для структурированного разбора документа или OCR. */
export async function deepseekReasoningJson(
  system: string,
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  return deepseekChatCompletion({
    model: deepseekModelAccurate(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
    maxTokens: 4096,
    temperature: 0.1,
    responseFormatJson: true,
  });
}
