import "server-only";

/**
 * OpenRouter (https://openrouter.ai) — fallback провайдер ИИ для случаев,
 * когда Bedrock возвращает ошибку (геоблок, недоступность модели и т.п.).
 *
 * По умолчанию включается ТОЛЬКО при наличии OPENROUTER_API_KEY и явного
 * OPENROUTER_FALLBACK_ENABLED=1. Если ключ есть, но переключатель не задан —
 * fallback автоматически активен, чтобы прод не падал из-за единичной ошибки Bedrock.
 *
 * Для медицинских данных принудительно ставим data_collection: "deny" в provider hints
 * (это отсекает free-провайдеров с обязательным логированием/обучением).
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function openRouterFallbackEnabled(): boolean {
  if (!process.env.OPENROUTER_API_KEY?.trim()) return false;
  const flag = process.env.OPENROUTER_FALLBACK_ENABLED?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "no") return false;
  return true;
}

export function openRouterChatModel(): string {
  return (
    process.env.OPENROUTER_CHAT_MODEL?.trim() ||
    "nvidia/nemotron-3-super-120b-a12b:free"
  );
}

export function openRouterReasoningModel(): string {
  return (
    process.env.OPENROUTER_REASONING_MODEL?.trim() ||
    process.env.OPENROUTER_CHAT_MODEL?.trim() ||
    "nvidia/nemotron-3-super-120b-a12b:free"
  );
}

export function openRouterOcrModel(): string {
  return (
    process.env.OPENROUTER_OCR_MODEL?.trim() ||
    "google/gemma-4-31b-it:free"
  );
}

function dataCollectionMode(): "deny" | "allow" {
  const v = process.env.OPENROUTER_DATA_RETENTION?.trim().toLowerCase();
  return v === "allow" ? "allow" : "deny";
}

function commonHeaders(): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://adventory.store";
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
  if (!openRouterFallbackEnabled()) {
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

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: commonHeaders(),
      body: JSON.stringify(body),
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

/** OCR изображения через OpenRouter (Gemma multimodal): Vision-через-image_url с base64. */
export async function openRouterVisionExtract(
  system: string,
  userText: string,
  buffer: Buffer,
  mimeType: string,
  model = openRouterOcrModel(),
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
