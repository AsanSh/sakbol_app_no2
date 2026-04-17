import { NextRequest, NextResponse } from "next/server";
import { APP_NAME } from "@/constants";
import { prisma } from "@/lib/prisma";
import { telegramGetChatId, telegramSendOtpMessage } from "@/lib/telegram-bot-api";
import { generateWebOtpCode, hashWebOtpCode } from "@/lib/web-otp";

export const dynamic = "force-dynamic";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function normalizeUsername(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^\d+$/.test(t)) return t;
  return t.startsWith("@") ? t : `@${t}`;
}

/**
 * Запрос кода в Telegram для входа с сайта. Нужен профиль с тем же telegramUserId и диалог с ботом.
 */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json({ error: "Сервер не настроен (TELEGRAM_BOT_TOKEN)." }, { status: 503 });
  }

  let body: { telegram?: string };
  try {
    body = (await req.json()) as { telegram?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const telegramRaw = body.telegram?.trim() ?? "";
  if (!telegramRaw) {
    return NextResponse.json({ error: "Укажите Telegram: @username или числовой id." }, { status: 400 });
  }

  const chatRef = normalizeUsername(telegramRaw);

  const resolved = await telegramGetChatId(chatRef);
  if (!resolved.ok) {
    return NextResponse.json(
      {
        error:
          "Не удалось найти этот Telegram. Откройте бота, нажмите Start, затем укажите тот же @username, что в профиле Telegram.",
      },
      { status: 400 },
    );
  }

  const telegramUserId = resolved.id;

  const profile = await prisma.profile.findUnique({
    where: { telegramUserId },
  });

  if (!profile) {
    return NextResponse.json(
      {
        error:
          "Аккаунт с этим Telegram не найден. Сначала зарегистрируйтесь в мини-приложении бота (ПИН), затем войдите на сайте.",
      },
      { status: 404 },
    );
  }

  const now = new Date();
  const cooldownSince = new Date(now.getTime() - RESEND_COOLDOWN_MS);

  const lastSend = await prisma.webOtpChallenge.findFirst({
    where: { telegramUserId, createdAt: { gte: cooldownSince } },
    orderBy: { createdAt: "desc" },
  });

  if (lastSend) {
    return NextResponse.json(
      { error: "Код уже отправлен недавно. Подождите минуту или проверьте чат с ботом." },
      { status: 429 },
    );
  }

  await prisma.webOtpChallenge.deleteMany({
    where: {
      telegramUserId,
      consumedAt: null,
      expiresAt: { gt: now },
    },
  });

  const code = generateWebOtpCode();
  const codeHash = hashWebOtpCode(code);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  const sent = await telegramSendOtpMessage(telegramUserId, code, APP_NAME);
  if (!sent.ok) {
    console.error("[web-otp/request] sendMessage:", sent.description);
    return NextResponse.json(
      { error: "Не удалось отправить код. Проверьте, что вы написали боту и попробуйте снова." },
      { status: 502 },
    );
  }

  const row = await prisma.webOtpChallenge.create({
    data: {
      telegramUserId,
      codeHash,
      expiresAt,
    },
  });

  return NextResponse.json({
    ok: true,
    challengeId: row.id,
    expiresAt: row.expiresAt.toISOString(),
  });
}
