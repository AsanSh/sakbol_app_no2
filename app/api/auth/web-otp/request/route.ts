import { NextRequest, NextResponse } from "next/server";
import { APP_NAME } from "@/constants";
import { normalizeWebLoginPhoneDigits } from "@/lib/login-phone-digits";
import { prisma } from "@/lib/prisma";
import { telegramGetChatId, telegramSendOtpMessage } from "@/lib/telegram-bot-api";
import { parseTelegramChatRef } from "@/lib/telegram-identifier";
import { generateWebOtpCode, hashWebOtpCode } from "@/lib/web-otp";
import type { Profile } from "@prisma/client";

export const dynamic = "force-dynamic";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const NOT_LINKED_HINT =
  "Этот Telegram не привязан к SakBol. Сначала зарегистрируйтесь в мини-приложении бота (введите ПИН/ИНН), затем возвращайтесь сюда — код придёт в чат с ботом.";

/**
 * Web-вход по коду из Telegram.
 *
 * Фронт шлёт два поля: `telegram` (@username, t.me/…, числовой id) и/или `phone` (тот же номер,
 * что пользователь сохранил в Профиле как «Номер для кода с сайта»). Хотя бы одно — обязательно.
 * Код приходит в чат с ботом, поэтому профиль обязан быть привязан к Telegram.
 */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json({ error: "Сервер не настроен (TELEGRAM_BOT_TOKEN)." }, { status: 503 });
  }

  let body: { telegram?: string; phone?: string };
  try {
    body = (await req.json()) as { telegram?: string; phone?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const phoneNorm = normalizeWebLoginPhoneDigits(body.phone?.trim() ?? "");
  const tgInput = body.telegram?.trim() ?? "";

  if (!phoneNorm && !tgInput) {
    return NextResponse.json(
      {
        error:
          "Укажите Telegram (@username, id, ссылка t.me) и/или номер телефона, сохранённый в Профиле.",
      },
      { status: 400 },
    );
  }

  let profile: Profile | null = null;

  // 1) Сначала пробуем по сохранённому номеру (быстрый и стабильный путь).
  if (phoneNorm) {
    profile = await prisma.profile.findFirst({ where: { webLoginPhoneDigits: phoneNorm } });
  }

  // 2) Если по номеру не нашлось — пробуем Telegram-идентификатор.
  if (!profile && tgInput) {
    const parsed = parseTelegramChatRef(tgInput);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // 2a) @username сохранён в БД — ищем напрямую без обращения к Telegram API.
    if (parsed.ref.startsWith("@")) {
      const uname = parsed.ref.slice(1).toLowerCase();
      profile = await prisma.profile.findFirst({
        where: { telegramUsername: uname, NOT: { telegramUserId: null } },
      });
    }

    // 2b) Иначе спросим Telegram — он вернёт chat_id (если пользователь нажимал /start).
    if (!profile) {
      const got = await telegramGetChatId(parsed.ref);
      if (got.ok) {
        profile = await prisma.profile.findUnique({ where: { telegramUserId: got.id } });
      }
    }
  }

  if (!profile?.telegramUserId) {
    return NextResponse.json({ error: NOT_LINKED_HINT }, { status: 404 });
  }

  const telegramUserId = profile.telegramUserId;
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
    where: { telegramUserId, consumedAt: null, expiresAt: { gt: now } },
  });

  const code = generateWebOtpCode();
  const codeHash = hashWebOtpCode(code);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  const sent = await telegramSendOtpMessage(telegramUserId, code, APP_NAME);
  if (!sent.ok) {
    console.error("[web-otp/request] sendMessage:", sent.description);
    return NextResponse.json(
      { error: "Не удалось отправить код. Проверьте, что нажали /start в боте." },
      { status: 502 },
    );
  }

  const row = await prisma.webOtpChallenge.create({
    data: { telegramUserId, codeHash, expiresAt },
  });

  return NextResponse.json({
    ok: true,
    challengeId: row.id,
    expiresAt: row.expiresAt.toISOString(),
  });
}
