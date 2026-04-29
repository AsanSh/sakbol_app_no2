import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFamilySubscription } from "@/lib/premium";
import { applyPendingProfileAccessForTelegramUser } from "@/lib/profile-access-accept";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/session";
import { verifyWebOtpCodeHash } from "@/lib/web-otp";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 8;

function profileJson(profile: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  familyRole: string;
  familyId: string;
  pinAnchor: string | null;
}) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    familyRole: profile.familyRole,
    familyId: profile.familyId,
    needsPinCompletion: profile.pinAnchor == null,
  };
}

export async function POST(req: NextRequest) {
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (!sessionSecret || sessionSecret.length < 16) {
    return NextResponse.json(
      { error: "Сервер не настроен (SESSION_SECRET: нужна строка не короче 16 символов)." },
      { status: 503 },
    );
  }

  let body: { challengeId?: string; code?: string };
  try {
    body = (await req.json()) as { challengeId?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const challengeId = body.challengeId?.trim();
  const code = body.code?.trim() ?? "";
  if (!challengeId || !code) {
    return NextResponse.json({ error: "Нужны challengeId и код." }, { status: 400 });
  }

  const normalizedCode = code.replace(/\D/g, "").slice(0, 6);
  if (normalizedCode.length !== 6) {
    return NextResponse.json({ error: "Введите 6 цифр кода из Telegram." }, { status: 400 });
  }

  const row = await prisma.webOtpChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!row || row.consumedAt) {
    return NextResponse.json({ error: "Запрос устарел. Запросите код снова." }, { status: 400 });
  }

  if (row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Код истёк. Запросите новый." }, { status: 400 });
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Слишком много попыток. Запросите код снова." }, { status: 429 });
  }

  const ok = verifyWebOtpCodeHash(normalizedCode, row.codeHash);

  if (!ok) {
    await prisma.webOtpChallenge.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "Неверный код." }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { telegramUserId: row.telegramUserId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден." }, { status: 404 });
  }

  await prisma.webOtpChallenge.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  if (profile.telegramUserId) {
    try {
      await applyPendingProfileAccessForTelegramUser(profile.telegramUserId, profile.id);
    } catch (e) {
      console.error("[web-otp/verify] applyPendingProfileAccess", e);
    }
  }

  try {
    await ensureFamilySubscription(profile.familyId);
  } catch (e) {
    console.error("[web-otp/verify] ensureFamilySubscription", e);
  }

  const token = createSessionToken({
    profileId: profile.id,
    familyId: profile.familyId,
  });

  const res = NextResponse.json({
    ok: true,
    profile: profileJson(profile),
  });
  res.cookies.set(sessionCookieName(), token, sessionCookieOptions());
  return res;
}
