/**
 * Отправка сообщения пользователю через Bot API (личный чат: chat_id = telegram user id).
 */
export async function sendTelegramDirectMessage(
  telegramUserId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN жок." };
  }
  if (!/^\d+$/.test(telegramUserId)) {
    return { ok: false, error: "Telegram ID сан эмес (мисалы, демо-сеед)." };
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !json.ok) {
    return {
      ok: false,
      error: json.description ?? `Telegram ${res.status}`,
    };
  }
  return { ok: true };
}
