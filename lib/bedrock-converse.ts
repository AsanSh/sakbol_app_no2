import "server-only";

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type ConversationRole,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";

/**
 * Единый переключатель: ИИ через Amazon Bedrock (IAM или Bearer), без прямых OpenAI/Gemini/Anthropic.
 * Имя сохранено для обратной совместимости env: ANTHROPIC_PROVIDER=bedrock.
 * По умолчанию используется Amazon Nova (доступен без гео-блокировок Anthropic).
 */
export function anthropicProviderIsBedrock(): boolean {
  return process.env.ANTHROPIC_PROVIDER?.trim().toLowerCase() === "bedrock";
}

export function bedrockRuntimeRegion(): string {
  return (
    process.env.BEDROCK_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    "us-east-1"
  );
}

/** Модель для текстового чата (вкладка «ИИ»). По умолчанию Amazon Nova Lite. */
export function bedrockLabModelId(): string {
  return (
    process.env.BEDROCK_LAB_MODEL_ID?.trim() ||
    "us.amazon.nova-lite-v1:0"
  );
}

/** Модель для OCR бланков (PDF/фото). По умолчанию Amazon Nova Pro (multimodal). */
export function bedrockLabOcrModelId(): string {
  return (
    process.env.BEDROCK_LAB_OCR_MODEL_ID?.trim() ||
    process.env.BEDROCK_LAB_MODEL_ID?.trim() ||
    "us.amazon.nova-pro-v1:0"
  );
}

function hasBedrockBearer(): boolean {
  return !!process.env.AWS_BEARER_TOKEN_BEDROCK?.trim();
}

/** Таймаут для одного вызова Bedrock (мс). По умолчанию 25 сек чат / 60 сек OCR. */
function bedrockTimeoutMs(modelId: string): number {
  const env = process.env.BEDROCK_TIMEOUT_MS?.trim();
  if (env && /^\d+$/.test(env)) return Math.max(2000, Number(env));
  if (modelId === bedrockLabOcrModelId()) return 60_000;
  return 25_000;
}

/** Bearer из консоли Bedrock или IAM / instance role / ECS task role и т.д. */
export function bedrockAuthConfigured(): boolean {
  if (hasBedrockBearer()) return true;
  if (process.env.AWS_ACCESS_KEY_ID?.trim() && process.env.AWS_SECRET_ACCESS_KEY?.trim()) {
    return true;
  }
  if (process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) return true;
  if (process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI) return true;
  if (process.env.AWS_WEB_IDENTITY_TOKEN_FILE) return true;
  if (process.env.AWS_PROFILE?.trim()) return true;
  return false;
}

function extractConverseText(out: ConverseCommandOutput): string {
  const parts = out.output?.message?.content ?? [];
  return parts
    .map((b) => ("text" in b && typeof b.text === "string" ? b.text : ""))
    .join("")
    .trim();
}

/** JSON для REST Converse: бинарные поля — base64-строки. */
function contentBlocksForRestApi(blocks: ContentBlock[]): unknown[] {
  const out: unknown[] = [];
  for (const block of blocks) {
    if ("text" in block && block.text !== undefined) {
      out.push({ text: block.text });
      continue;
    }
    if ("image" in block && block.image?.format && block.image.source && "bytes" in block.image.source) {
      const raw = block.image.source.bytes;
      const buf = Buffer.from(raw as Uint8Array);
      out.push({
        image: {
          format: block.image.format,
          source: { bytes: buf.toString("base64") },
        },
      });
      continue;
    }
    if (
      "document" in block &&
      block.document?.format &&
      block.document.name &&
      block.document.source &&
      "bytes" in block.document.source
    ) {
      const raw = block.document.source.bytes;
      const buf = Buffer.from(raw as Uint8Array);
      out.push({
        document: {
          format: block.document.format,
          name: block.document.name,
          source: { bytes: buf.toString("base64") },
        },
      });
      continue;
    }
    throw new Error("Bedrock: неподдерживаемый блок content для REST.");
  }
  return out;
}

async function converseViaBearer(
  modelId: string,
  body: {
    system: Array<{ text: string }>;
    messages: Array<{ role: string; content: unknown[] }>;
    inferenceConfig: { maxTokens: number; temperature: number };
  },
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim();
  if (!token) {
    return { ok: false, userMessage: "NO_KEY" };
  }
  const region = bedrockRuntimeRegion();
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;
  const timeoutMs = bedrockTimeoutMs(modelId);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        userMessage: `Bedrock ${res.status}: ${bodyText.slice(0, 320)}`,
      };
    }
    const json = JSON.parse(bodyText) as ConverseCommandOutput;
    const text = extractConverseText(json);
    if (!text) {
      return { ok: false, userMessage: "Пустой ответ Bedrock." };
    }
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
      return { ok: false, userMessage: `Bedrock timeout (${timeoutMs} ms)` };
    }
    return { ok: false, userMessage: msg };
  }
}

async function converseViaIam(
  modelId: string,
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: ContentBlock[] }>,
  maxTokens: number,
  temperature: number,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  const timeoutMs = bedrockTimeoutMs(modelId);
  const abort = new AbortController();
  const t = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const client = new BedrockRuntimeClient({ region: bedrockRuntimeRegion() });
    const out = await client.send(
      new ConverseCommand({
        modelId,
        system: [{ text: system }],
        messages: messages.map((m) => ({
          role: m.role as ConversationRole,
          content: m.content,
        })),
        inferenceConfig: { maxTokens, temperature },
      }),
      { abortSignal: abort.signal },
    );
    const text = extractConverseText(out);
    if (!text) {
      return { ok: false, userMessage: "Пустой ответ Bedrock." };
    }
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && (e.name === "AbortError" || msg.includes("aborted"))) {
      return { ok: false, userMessage: `Bedrock timeout (${timeoutMs} ms)` };
    }
    if (/credentials|Credential|Unauthorized|ExpiredToken|InvalidAccessKeyId/i.test(msg)) {
      return { ok: false, userMessage: `NO_KEY: ${msg.slice(0, 200)}` };
    }
    return { ok: false, userMessage: msg };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Универсальный вызов Converse: сначала Bearer (если задан), иначе IAM через SDK.
 */
export async function bedrockConverse(params: {
  modelId: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: ContentBlock[] }>;
  maxTokens: number;
  temperature: number;
}): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  const { modelId, system, messages, maxTokens, temperature } = params;

  if (hasBedrockBearer()) {
    const restMessages = messages.map((m) => ({
      role: m.role,
      content: contentBlocksForRestApi(m.content),
    }));
    return converseViaBearer(modelId, {
      system: [{ text: system }],
      messages: restMessages,
      inferenceConfig: { maxTokens, temperature },
    });
  }

  if (!bedrockAuthConfigured()) {
    return {
      ok: false,
      userMessage: "NO_KEY",
    };
  }

  return converseViaIam(modelId, system, messages, maxTokens, temperature);
}

export async function bedrockConverseText(
  system: string,
  userText: string,
  modelId = bedrockLabModelId(),
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  return bedrockConverse({
    modelId,
    system,
    messages: [{ role: "user", content: [{ text: userText }] }],
    maxTokens: 2048,
    temperature: 0.35,
  });
}

export function mimeToBedrockImageFormat(mime: string): "png" | "jpeg" | "gif" | "webp" {
  const m = mime.toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/jpeg" || m === "image/jpg") return "jpeg";
  if (m === "image/gif") return "gif";
  if (m === "image/webp") return "webp";
  throw new Error(`Bedrock OCR: неподдерживаемый тип изображения (${mime}).`);
}
