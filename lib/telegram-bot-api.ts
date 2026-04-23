import "server-only";

type TgOk<T> = { ok: true; result: T };
type TgErr = { ok: false; description?: string; error_code?: number };

async function tgCall<T>(path: string, init?: RequestInit): Promise<TgOk<T> | TgErr> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN missing" };
  }
  const url = `https://api.telegram.org/bot${botToken}/${path}`;
  const res = await fetch(url, { ...init, cache: "no-store" });
  return (await res.json()) as TgOk<T> | TgErr;
}

/** @param chatIdOrUsername — числовой id или @username (пользователь должен был нажать Start у бота). */
export async function telegramGetChatId(
  chatIdOrUsername: string,
): Promise<{ ok: true; id: string } | { ok: false; description: string }> {
  const q = encodeURIComponent(chatIdOrUsername);
  const j = await tgCall<{ id: number; type: string }>(`getChat?chat_id=${q}`);
  if (!j.ok) {
    return { ok: false, description: j.description ?? "getChat failed" };
  }
  return { ok: true, id: String(j.result.id) };
}

export async function telegramSendOtpMessage(
  chatId: string,
  code: string,
  appName: string,
): Promise<{ ok: true } | { ok: false; description: string }> {
  const text = `🔐 <b>${appName}</b> — код для входа на сайте:\n\n<code>${code}</code>\n\nКод действует 10 минут. Если это не вы, просто игнорируйте сообщение.`;
  const j = await tgCall<unknown>("sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
  if (!j.ok) {
    return { ok: false, description: j.description ?? "sendMessage failed" };
  }
  return { ok: true };
}

export async function telegramSendPlainMessage(
  chatId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; description: string }> {
  const j = await tgCall<unknown>("sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
  if (!j.ok) {
    return { ok: false, description: j.description ?? "sendMessage failed" };
  }
  return { ok: true };
}

export async function telegramSendMessageWithUrlButton(
  chatId: string,
  text: string,
  buttonText: string,
  buttonUrl: string,
): Promise<{ ok: true } | { ok: false; description: string }> {
  const j = await tgCall<unknown>("sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
      },
    }),
  });
  if (!j.ok) {
    return { ok: false, description: j.description ?? "sendMessage failed" };
  }
  return { ok: true };
}

type GetFileResult = { file_id: string; file_path: string };

/** Скачать файл, отправленный пользователем боту (document / сжатый снимок). */
export async function telegramDownloadFile(
  fileId: string,
): Promise<{ ok: true; buffer: Buffer; mime: string } | { ok: false; description: string }> {
  const j = await tgCall<GetFileResult>(`getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!j.ok || !j.result?.file_path) {
    return { ok: false, description: j.ok ? "no file_path" : (j.description ?? "getFile failed") };
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN missing" };
  }
  const url = `https://api.telegram.org/file/bot${botToken}/${j.result.file_path}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return { ok: false, description: `download failed ${res.status}` };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  return { ok: true, buffer: buf, mime };
}
