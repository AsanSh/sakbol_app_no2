import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { telegramBotUsernameFromEnv } from "@/lib/telegram-public-urls";

export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;

/**
 * Создать одноразовый код привязки Telegram (веб, сессия). Пользователь: /start КОД у бота.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  if (profile.telegramUserId) {
    return NextResponse.json({ error: "Telegram уже привязан к этому профилю." }, { status: 400 });
  }

  const now = new Date();
  await prisma.telegramLinkCode.deleteMany({
    where: {
      profileId: profile.id,
      consumedAt: null,
      expiresAt: { gt: now },
    },
  });

  let code = "";
  for (let i = 0; i < 12; i++) {
    const c = String(randomInt(100000, 999999));
    const clash = await prisma.telegramLinkCode.findFirst({
      where: {
        code: c,
        consumedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (!clash) {
      code = c;
      break;
    }
  }
  if (!code) {
    return NextResponse.json({ error: "Не удалось сгенерировать код. Повторите." }, { status: 503 });
  }

  const expiresAt = new Date(now.getTime() + TTL_MS);
  await prisma.telegramLinkCode.create({
    data: {
      profileId: profile.id,
      code,
      expiresAt,
    },
  });

  const bot = telegramBotUsernameFromEnv();

  return NextResponse.json({
    ok: true,
    code,
    expiresAt: expiresAt.toISOString(),
    botUsername: bot || null,
    hint: bot
      ? `В Telegram откройте @${bot} и отправьте: /start ${code}`
      : "Отправьте боту команду /start с этим кодом.",
  });
}
