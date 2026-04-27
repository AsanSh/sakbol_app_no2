import { NextResponse } from "next/server";
import { telegramGetMe, telegramGetWebhookInfo } from "@/lib/telegram-bot-api";

export const dynamic = "force-dynamic";

/**
 * Диагностика Telegram-интеграции (только для админов / dev-окружения).
 *
 * GET /api/debug/telegram-status
 *
 * Активируется одним из условий:
 *   - NODE_ENV != "production"
 *   - либо в production задан DEBUG_TELEGRAM_STATUS_TOKEN, и клиент шлёт его в `?token=`.
 *
 * Возвращает: какой бот видит сервер по TELEGRAM_BOT_TOKEN, какой webhook установлен,
 * совпадает ли публичный username из NEXT_PUBLIC_TELEGRAM_BOT_USERNAME, есть ли webhook secret.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const allowed =
    process.env.NODE_ENV !== "production" ||
    (process.env.DEBUG_TELEGRAM_STATUS_TOKEN &&
      url.searchParams.get("token")?.trim() ===
        process.env.DEBUG_TELEGRAM_STATUS_TOKEN.trim());
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const env = {
    TELEGRAM_BOT_TOKEN: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
    TELEGRAM_WEBHOOK_SECRET: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim()),
    SESSION_SECRET: Boolean(process.env.SESSION_SECRET?.trim()),
    PIN_ANCHOR_PEPPER: Boolean(process.env.PIN_ANCHOR_PEPPER?.trim()),
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME:
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() ?? null,
    APP_ORIGIN: process.env.APP_ORIGIN?.trim() ?? null,
  };

  const me = await telegramGetMe();
  const webhook = await telegramGetWebhookInfo();

  const expectedUsername = env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const actualUsername = me.ok ? me.username : null;
  const usernameMatches =
    expectedUsername && actualUsername
      ? expectedUsername.replace(/^@/, "").toLowerCase() === actualUsername.toLowerCase()
      : null;

  return NextResponse.json({
    ok: true,
    env,
    bot: me.ok
      ? { id: me.id, username: me.username, firstName: me.firstName }
      : { error: me.description },
    webhook: webhook.ok
      ? {
          url: webhook.url,
          pendingUpdateCount: webhook.pendingUpdateCount,
          lastErrorMessage: webhook.lastErrorMessage,
          lastErrorDate: webhook.lastErrorDate,
        }
      : { error: webhook.description },
    consistency: {
      botUsernameMatchesPublicEnv: usernameMatches,
      webhookSet: webhook.ok ? webhook.url.length > 0 : false,
    },
  });
}
