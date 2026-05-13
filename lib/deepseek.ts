import "server-only";

/**
 * DeepSeek (https://platform.deepseek.com) — OpenAI-совместимый провайдер.
 * Включается автоматически при наличии DEEPSEEK_API_KEY.
 * Только текстовые модели (`deepseek-chat`): PDF/картинки в API не шлём напрямую.
 * Для PDF после `pdf-parse` при сканах подставляется текст из Poppler+Tesseract (`health-document-text-extract`).
 *
 * Переменные:
 *   DEEPSEEK_API_KEY   — обязательный
 *   DEEPSEEK_MODEL     — модель (по умолчанию deepseek-chat / DeepSeek-V3)
 *   DEEPSEEK_TIMEOUT_MS — таймаут в мс (по умолчанию 60000)
 *   DEEPSEEK_TRANSLATE_TIMEOUT_MS — отдельный таймаут для перевода документов (по умолчанию 120000)
 */

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

export function deepseekEnabled(): boolean {
  return !!process.env.DEEPSEEK_API_KEY?.trim();
}

export function deepseekModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || DEEPSEEK_DEFAULT_MODEL;
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

  const model = params.model ?? deepseekModel();
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
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
    maxTokens: 4096,
    temperature: 0.1,
    responseFormatJson: true,
  });
}
