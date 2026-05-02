import "server-only";

/**
 * Текстовый ответ Claude — интерпретация показателей (вкладка «ИИ» / «Что это значит»).
 * Требует ANTHROPIC_API_KEY. Модель по умолчанию: Claude 3.5 Sonnet.
 */
export async function generateClaudeLabChatAnswer(
  system: string,
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return { ok: false, userMessage: "NO_KEY" };
  }

  const model =
    process.env.ANTHROPIC_LAB_MODEL?.trim() || "claude-3-5-sonnet-20241022";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system,
        messages: [{ role: "user", content: userText }],
      }),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        userMessage: `Anthropic ${res.status}: ${bodyText.slice(0, 280)}`,
      };
    }

    const json = JSON.parse(bodyText) as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string };
    };
    if (json.error?.message) {
      return { ok: false, userMessage: json.error.message };
    }

    const parts = json.content ?? [];
    const text = parts
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();

    if (!text) {
      return { ok: false, userMessage: "Пустой ответ Claude." };
    }
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, userMessage: msg };
  }
}
