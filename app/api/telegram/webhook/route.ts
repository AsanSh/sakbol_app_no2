import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { telegramSendPlainMessage } from "@/lib/telegram-bot-api";

export const dynamic = "force-dynamic";

type TgMessage = {
  message?: {
    chat?: { id: number; type?: string };
    from?: { id: number; first_name?: string };
    text?: string;
  };
};

function extractStartCode(text: string): string | null {
  const t = text.trim();
  const m = /^\/start(?:\s+(\S+))?$/i.exec(t);
  const arg = m?.[1]?.trim();
  if (!arg) return null;
  const digits = arg.replace(/\D/g, "");
  if (digits.length >= 5 && digits.length <= 8) return digits.slice(0, 8);
  return null;
}

/**
 * Webhook Telegram Bot API. В BotFather: setWebhook URL + secret_token (как TELEGRAM_WEBHOOK_SECRET).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !secret) {
    return NextResponse.json({ error: "TELEGRAM_WEBHOOK_SECRET required" }, { status: 503 });
  }
  if (secret) {
    const hdr = req.headers.get("x-telegram-bot-api-secret-token");
    if (hdr !== secret) {
      return new NextResponse("forbidden", { status: 403 });
    }
  }

  let update: TgMessage;
  try {
    update = (await req.json()) as TgMessage;
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const msg = update.message;
  const text = msg?.text;
  const chatId = msg?.chat?.id;
  const fromId = msg?.from?.id;

  if (!text || chatId == null || fromId == null) {
    return NextResponse.json({ ok: true });
  }

  const code = extractStartCode(text);
  if (!code) {
    return NextResponse.json({ ok: true });
  }

  const tgUserId = String(fromId);
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.telegramLinkCode.findFirst({
        where: {
          code,
          consumedAt: null,
          expiresAt: { gt: now },
        },
      });

      if (!row) {
        return { type: "invalid" as const };
      }

      const profile = await tx.profile.findUnique({
        where: { id: row.profileId },
      });

      if (!profile) {
        return { type: "invalid" as const };
      }

      if (profile.telegramUserId) {
        return { type: "already_profile" as const, chatId };
      }

      const taken = await tx.profile.findUnique({
        where: { telegramUserId: tgUserId },
      });

      if (taken && taken.id !== profile.id) {
        return { type: "tg_busy" as const, chatId };
      }

      await tx.profile.update({
        where: { id: profile.id },
        data: { telegramUserId: tgUserId },
      });

      await tx.telegramLinkCode.update({
        where: { id: row.id },
        data: { consumedAt: now },
      });

      return { type: "ok" as const, chatId, displayName: profile.displayName };
    });

    if (result.type === "ok") {
      await telegramSendPlainMessage(
        String(result.chatId),
        `✅ Аккаунт «${result.displayName}» привязан к Telegram. Откройте SakBol в браузере или мини-приложении.`,
      );
    } else if (result.type === "tg_busy") {
      await telegramSendPlainMessage(
        String(result.chatId),
        "Этот Telegram уже привязан к другому профилю SakBol. Обратитесь в поддержку.",
      );
    } else if (result.type === "already_profile") {
      await telegramSendPlainMessage(String(result.chatId), "Этот профиль уже был привязан ранее.");
    } else {
      await telegramSendPlainMessage(
        String(chatId),
        "Код не найден или истёк. Создайте новый код в личном кабинете на сайте (Привязать Telegram).",
      );
    }
  } catch (e) {
    console.error("telegram webhook", e);
  }

  return NextResponse.json({ ok: true });
}
