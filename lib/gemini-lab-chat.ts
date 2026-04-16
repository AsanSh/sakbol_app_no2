import "server-only";

const GEMINI_API_VERSIONS = ["v1beta", "v1"] as const;

function geminiModelCandidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  const fallbacks = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-8b",
    "gemini-1.5-flash",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro",
    "gemini-1.5-pro-002",
  ];
  const raw = (fromEnv ? [fromEnv, ...fallbacks] : fallbacks).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of raw) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

function shouldTryNextGeminiModel(errMsg: string): boolean {
  return /(^|\s)404(\s|:)|\bNOT_FOUND\b|is not found for API version|not supported for generateContent/i.test(
    errMsg,
  );
}

function humanizeGeminiFailureForUser(raw: string): string {
  const t = raw.trim();
  if (/\b429\b|quota|Quota exceeded|exceeded your current quota|rate limit|RESOURCE_EXHAUSTED/i.test(t)) {
    return [
      "Квота Gemini исчерпана или для ключа не включён доступ к API.",
      "Проверьте лимиты в Google AI Studio и повторите позже.",
    ].join(" ");
  }
  if (/\b403\b|PERMISSION_DENIED/i.test(t)) {
    return "Доступ к Gemini запрещён (403). Проверьте ключ и API в проекте.";
  }
  if (/\b400\b|API key not valid|API_KEY_INVALID|invalid API key/i.test(t)) {
    return "Ключ GEMINI_API_KEY недействителен. Обновите переменную на сервере.";
  }
  return `Не удалось получить ответ от Gemini. ${t.slice(0, 220)}${t.length > 220 ? "…" : ""}`;
}

/**
 * Текстовый ответ Gemini (без PDF/картинок) — для вкладки «ИИ».
 */
export async function generateGeminiLabChatAnswer(
  systemInstruction: string,
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return { ok: false, userMessage: "NO_KEY" };
  }

  const models = geminiModelCandidates();
  let lastErr = "";

  for (const model of models) {
    for (const apiVersion of GEMINI_API_VERSIONS) {
      try {
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: "user", parts: [{ text: userText }] }],
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 2048,
            },
          }),
        });

        const bodyText = await res.text();
        if (!res.ok) {
          throw new Error(`Gemini ${res.status} [${apiVersion}/${model}]: ${bodyText.slice(0, 400)}`);
        }

        const json = JSON.parse(bodyText) as {
          candidates?: Array<{
            finishReason?: string;
            content?: { parts?: Array<{ text?: string }> };
          }>;
          promptFeedback?: { blockReason?: string };
        };
        if (json.promptFeedback?.blockReason) {
          throw new Error(`Gemini blocked: ${json.promptFeedback.blockReason}`);
        }
        if (!json.candidates?.length) throw new Error("Gemini: empty candidates");
        const cand = json.candidates[0];
        const fr = cand?.finishReason;
        if (fr && fr !== "STOP" && fr !== "MAX_TOKENS") {
          throw new Error(`Gemini finish: ${fr}`);
        }
        const text =
          cand?.content?.parts?.map((part) => part.text ?? "").join("")?.trim() ?? "";
        if (!text) throw new Error("Empty Gemini response");
        return { ok: true, text };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        lastErr = msg;
        if (shouldTryNextGeminiModel(msg)) continue;
        return { ok: false, userMessage: humanizeGeminiFailureForUser(msg) };
      }
    }
  }

  return {
    ok: false,
    userMessage: humanizeGeminiFailureForUser(
      `Gemini: ни одна модель не подошла. ${lastErr.slice(0, 200)}`,
    ),
  };
}
