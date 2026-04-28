import { NextResponse } from "next/server";
import { telegramGetMe } from "@/lib/telegram-bot-api";

export const dynamic = "force-dynamic";

/**
 * Публичный username бота (без @) для QR «поделиться профилем».
 * Берётся через getMe по TELEGRAM_BOT_TOKEN — не нужен NEXT_PUBLIC_TELEGRAM_BOT_USERNAME в бандле.
 */
export async function GET() {
  const me = await telegramGetMe();
  if (!me.ok || !me.username) {
    return NextResponse.json({ username: null });
  }
  return NextResponse.json({ username: me.username });
}
