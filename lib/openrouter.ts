import "server-only";

/**
 * OpenRouter (https://openrouter.ai) — чат/перевод (Gemma), OCR и разбор фото бланков (Nemotron Omni),
 * резерв когда Bedrock недоступен.
 *
 * Включение: OPENROUTER_API_KEY и OPENROUTER_ENABLED=1 (или legacy OPENROUTER_FALLBACK_ENABLED=1).
 * Отключить явно: OPENROUTER_DISABLED=1.
 *
 * Для медицинских данных принудительно ставим data_collection: "deny" в provider hints
 * (это отсекает free-провайдеров с обязательным логированием/обучением).
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Явный доступ к OpenRouter (чат, перевод, vision/OCR, reasoning fallback). */
export function openRouterEnabled(): boolean {
  if (!process.env.OPENROUTER_API_KEY?.trim()) return false;
  const disabled = process.env.OPENROUTER_DISABLED?.trim().toLowerCase();
  if (disabled === "1" || disabled === "true" || disabled === "yes") return false;
  const enabled = process.env.OPENROUTER_ENABLED?.trim().toLowerCase();
  if (enabled === "1" || enabled === "true" || enabled === "yes") return true;
  const fallback = process.env.OPENROUTER_FALLBACK_ENABLED?.trim().toLowerCase();
  return fallback === "1" || fallback === "true" || fallback === "yes";
}

/** @deprecated Используйте openRouterEnabled — то же поведение (ключ + ENABLED или FALLBACK). */
export function openRouterFallbackEnabled(): boolean {
  return openRouterEnabled();
}

export function openRouterChatModel(): string {
  return (
    process.env.OPENROUTER_CHAT_MODEL?.trim() ||
    "google/gemma-4-31b:free"
  );
}

/** JSON-reasoning (расшифровка документов, fallback после Bedrock): Gemma 31B по умолчанию. */
export function openRouterReasoningModel(): string {
  return (
    process.env.OPENROUTER_REASONING_MODEL?.trim() ||
    process.env.OPENROUTER_CHAT_MODEL?.trim() ||
    "google/gemma-4-31b:free"
  );
}

/** PDF и текстовый OCR-пайплайн после pdf-parse (структурированный JSON). */
export function openRouterOcrModel(): string {
  return (
    process.env.OPENROUTER_OCR_MODEL?.trim() ||
    "nvidia/nemotron-3-nano-omni:free"
  );
}

/** Фото бланков / сканы как изображение (vision + JSON). Разумное рассуждение для таблиц показателей. */
export function openRouterVisionModel(): string {
  return (
    process.env.OPENROUTER_VISION_MODEL?.trim() ||
    process.env.OPENROUTER_OCR_MODEL?.trim() ||
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
  );
}

function dataCollectionMode(): "deny" | "allow" {
  const v = process.env.OPENROUTER_DATA_RETENTION?.trim().toLowerCase();
  return v === "allow" ? "allow" : "deny";
}

function openRouterTimeoutMs(): number {
  const env = process.env.OPENROUTER_TIMEOUT_MS?.trim();
  if (env && /^\d+$/.test(env)) return Math.max(2000, Number(env));
  return 120_000;
}

function commonHeaders(): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://adventroy.store";
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "SakBol";
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!.trim()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": referer,
    "X-Title": title,
  };
}

export type OpenRouterMessageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterMessageContent[];
};

export async function openRouterChatCompletion(params: {
  model: string;
  messages: OpenRouterMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormatJson?: boolean;
}): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  if (!openRouterEnabled()) {
    return { ok: false, userMessage: "OPENROUTER_DISABLED" };
  }
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    max_tokens: params.maxTokens ?? 2048,
    temperature: params.temperature ?? 0.3,
    provider: { data_collection: dataCollectionMode() },
  };
  if (params.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  const timeoutMs = openRouterTimeoutMs();
  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: commonHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        userMessage: `OpenRouter ${res.status}: ${bodyText.slice(0, 320)}`,
      };
    }
    const json = JSON.parse(bodyText) as {
      choices?: Array<{ message?: { content?: string | OpenRouterMessageContent[] } }>;
      error?: { message?: string };
    };
    if (json.error?.message) {
      return { ok: false, userMessage: `OpenRouter error: ${json.error.message}` };
    }
    const raw = json.choices?.[0]?.message?.content;
    let text = "";
    if (typeof raw === "string") {
      text = raw.trim();
    } else if (Array.isArray(raw)) {
      text = raw
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim();
    }
    if (!text) return { ok: false, userMessage: "OpenRouter: пустой ответ." };
    return { ok: true, text };
  } catch (e) {
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
      return { ok: false, userMessage: `OpenRouter timeout (${timeoutMs} ms)` };
    }
    return {
      ok: false,
      userMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function openRouterChatText(
  system: string,
  userText: string,
  model = openRouterChatModel(),
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  return openRouterChatCompletion({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
    maxTokens: 2048,
    temperature: 0.3,
  });
}

export async function openRouterReasoningJson(
  system: string,
  userText: string,
  model = openRouterReasoningModel(),
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  return openRouterChatCompletion({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
    maxTokens: 4096,
    temperature: 0.2,
    responseFormatJson: true,
  });
}

/** OCR / разбор фото бланков через OpenRouter (Nemotron Omni vision): image_url с base64. */
export async function openRouterVisionExtract(
  system: string,
  userText: string,
  buffer: Buffer,
  mimeType: string,
  model = openRouterVisionModel(),
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  if (!mimeType.startsWith("image/")) {
    return {
      ok: false,
      userMessage: "OpenRouter Vision: ожидается изображение (PNG/JPEG/WEBP).",
    };
  }
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
  return openRouterChatCompletion({
    model,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    maxTokens: 4096,
    temperature: 0.1,
    responseFormatJson: true,
  });
}

/** OCR PDF через OpenRouter: текст уже извлечён pdf-parse, передаём как обычный prompt. */
export async function openRouterPdfTextExtract(
  system: string,
  userText: string,
  pdfPlainText: string,
  model = openRouterOcrModel(),
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  const trimmed = pdfPlainText.replace(/\u0000/g, "").trim().slice(0, 60_000);
  if (!trimmed) {
    return { ok: false, userMessage: "PDF не содержит извлекаемого текста." };
  }
  const enrichedUser = `${userText}\n\n--- ТЕКСТ PDF (извлечён pdf-parse, может содержать артефакты) ---\n${trimmed}`;
  return openRouterChatCompletion({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: enrichedUser },
    ],
    maxTokens: 4096,
    temperature: 0.1,
    responseFormatJson: true,
  });
}
