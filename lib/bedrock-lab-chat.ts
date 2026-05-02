import "server-only";

/**
 * Вкладка «ИИ»: текст через Amazon Bedrock Converse + long-term API key.
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started-api-keys.html
 *
 * Env:
 * - AWS_BEARER_TOKEN_BEDROCK — ключ из консоли Bedrock (Bearer).
 * - BEDROCK_REGION — регион runtime (по умолчанию us-east-1).
 * - BEDROCK_LAB_MODEL_ID — modelId для Converse (по умолчанию Haiku из гайда AWS).
 */
export async function generateBedrockLabChatAnswer(
  system: string,
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim();
  if (!token) {
    return { ok: false, userMessage: "NO_KEY" };
  }

  const region = process.env.BEDROCK_REGION?.trim() || "us-east-1";
  const modelId =
    process.env.BEDROCK_LAB_MODEL_ID?.trim() || "us.anthropic.claude-3-5-haiku-20241022-v1:0";

  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        system: [{ text: system }],
        messages: [
          {
            role: "user",
            content: [{ text: userText }],
          },
        ],
        inferenceConfig: {
          maxTokens: 2048,
          temperature: 0.35,
        },
      }),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        userMessage: `Bedrock ${res.status}: ${bodyText.slice(0, 320)}`,
      };
    }

    const json = JSON.parse(bodyText) as {
      output?: { message?: { content?: Array<{ text?: string }> } };
    };

    const parts = json.output?.message?.content ?? [];
    const text = parts
      .map((b) => (typeof b.text === "string" ? b.text : ""))
      .join("")
      .trim();

    if (!text) {
      return { ok: false, userMessage: "Пустой ответ Bedrock." };
    }
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, userMessage: msg };
  }
}
