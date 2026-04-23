import { NextRequest, NextResponse } from "next/server";
import { APP_NAME } from "@/constants";
import { normalizeWebLoginPhoneDigits } from "@/lib/login-phone-digits";
import { prisma } from "@/lib/prisma";
import { telegramGetChatId, telegramSendOtpMessage } from "@/lib/telegram-bot-api";
import { parseTelegramChatRef, stringLooksMostlyLikePhone } from "@/lib/telegram-identifier";
import { generateWebOtpCode, hashWebOtpCode } from "@/lib/web-otp";
import type { Profile } from "@prisma/client";

export const dynamic = "force-dynamic";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function isPhoneInTelegramFieldOnly(phoneField: string, telegramField: string): boolean {
  if (phoneField.trim().length > 0) return false;
  if (!telegramField.trim()) return false;
  if (/(t\.me|telegram\.me|@)/i.test(telegramField)) return false;
  return stringLooksMostlyLikePhone(telegramField);
}

/**
 * Код в Telegram. Нужен чат с ботом. Узнаём вас по t.me / @ / id, либо по телефону,
 * сохранённому в Профиле (webLoginPhoneDigits).
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

  const rawPhone = body.phone?.trim() ?? "";
  const rawTg = body.telegram?.trim() ?? "";
  const phoneTreatedAsTg = isPhoneInTelegramFieldOnly(rawPhone, rawTg);
  const phoneNorm =
    normalizeWebLoginPhoneDigits(rawPhone) ??
    (phoneTreatedAsTg ? (normalizeWebLoginPhoneDigits(rawTg) ?? null) : null);
  const chatInput = phoneTreatedAsTg ? "" : rawTg;
  const userFilledBoth = rawPhone.length > 0 && rawTg.length > 0;

  if (!phoneNorm && !chatInput) {
    return NextResponse.json(
      {
        error:
          "Укажите Telegram (@username, id, ссылка t.me) и/или номер телефона, сохранённый в Профиле (приложение → тот же номер в блоке «код с сайта»).",
      },
      { status: 400 },
    );
  }

  let profileByPhone: Profile | null = null;
  if (phoneNorm) {
    profileByPhone = await prisma.profile.findFirst({ where: { webLoginPhoneDigits: phoneNorm } });
    if (!profileByPhone && !chatInput) {
      return NextResponse.json(
        {
          error:
            "Этот номер в базе не найден. Сохраните его в Профиле в приложении (Номер для кода с сайта) — тот же формат, что в Telegram, либо используйте @username, под которым написали /start боту.",
        },
        { status: 404 },
      );
    }
  }

  let profileByTg: Profile | null = null;
  if (chatInput) {
    const parsed = parseTelegramChatRef(chatInput);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (/^\d{12}$/.test(parsed.ref) && parsed.ref.startsWith("996")) {
      const p0 = await prisma.profile.findFirst({ where: { webLoginPhoneDigits: parsed.ref } });
      if (p0?.telegramUserId) {
        profileByTg = p0;
      }
    }
    if (!profileByTg) {
      const res = await telegramGetChatId(parsed.ref);
      if (res.ok) {
        const p1 = await prisma.profile.findUnique({ where: { telegramUserId: res.id } });
        if (!p1) {
          return NextResponse.json(
            {
              error:
                "Этот Telegram не привязан к SakBol. Сначала мини-приложение бота, регистрация (ПИН).",
            },
            { status: 404 },
          );
        }
        profileByTg = p1;
      } else {
        const unameFromRef = parsed.ref.startsWith("@")
          ? parsed.ref.slice(1).toLowerCase()
          : null;
        if (unameFromRef) {
          const pDb = await prisma.profile.findFirst({
            where: { telegramUsername: unameFromRef, NOT: { telegramUserId: null } },
          });
          if (pDb) {
            profileByTg = pDb;
          }
        }
        if (!profileByTg) {
          if (userFilledBoth) {
            return NextResponse.json(
              {
                error:
                  "Бот не видит такой @username / id, а по сохранённому @username в SakBol вас тоже не нашли. Войдите в мини-приложение бота (чтобы @username обновился в SakBol) или введите номер из «Вход на сайт по коду» в Профиле. Либо нажмите /start в чате с ботом и повторите.",
              },
              { status: 400 },
            );
          } else if (profileByPhone) {
            profileByTg = profileByPhone;
          } else {
            return NextResponse.json(
              {
                error:
                  "Бот не видит такой @username / id. Сначала нажмите /start. Укажите @username, как в Telegram, или вставьте ссылку t.me/… . Если заходили в мини-приложение (без /start) — введите в поле «телефон» номер из раздела «Вход на сайт по кода» в Профиле.",
              },
              { status: 400 },
            );
          }
        }
      }
    }
  } else {
    profileByTg = profileByPhone;
  }

  if (profileByPhone && profileByTg && profileByPhone.id !== profileByTg.id) {
    return NextResponse.json(
      { error: "Номер и Telegram указывают на разные аккаунты. Проверьте поля." },
      { status: 400 },
    );
  }

  const profile = profileByTg ?? profileByPhone;
  if (!profile?.telegramUserId) {
    return NextResponse.json(
      {
        error: "Профиль не найден. Нужна регистрация в мини-приложении бота (ПИН).",
      },
      { status: 404 },
    );
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
      { error: "Не удалось отправить код. Проверьте, что нажали /start в боте." },
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
