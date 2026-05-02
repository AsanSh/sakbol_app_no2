import "server-only";

/**
 * Текстовый ответ OpenAI (Chat Completions) — вкладка «ИИ» / «Что это значит».
 * Требует OPENAI_API_KEY. Модель: OPENAI_LAB_CHAT_MODEL или gpt-4o-mini.
 */
export async function generateOpenAILabChatAnswer(
  system: string,
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, userMessage: "NO_KEY" };
  }

  const model = process.env.OPENAI_LAB_CHAT_MODEL?.trim() || "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 2048,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userText },
        ],
      }),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        userMessage: `OpenAI ${res.status}: ${bodyText.slice(0, 280)}`,
      };
    }

    const json = JSON.parse(bodyText) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      error?: { message?: string };
    };
    if (json.error?.message) {
      return { ok: false, userMessage: json.error.message };
    }

    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return { ok: false, userMessage: "Пустой ответ OpenAI." };
    }
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, userMessage: msg };
  }
}
