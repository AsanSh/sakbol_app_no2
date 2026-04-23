import { FamilyRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFamilySubscription } from "@/lib/premium";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/session";
import { buildDisplayName, parseTelegramUserFromInitData } from "@/lib/telegram-init-data";
import { verifyTelegramInitData } from "@/lib/telegram";
import { pinAnchorFromUserInput } from "@/lib/pin-subject-anchor";

export const dynamic = "force-dynamic";

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

/** Единственное место проверки подписи initData; клиент только шлёт строку. */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error(
      "[telegram] TELEGRAM_BOT_TOKEN отсутствует в runtime. Часто: переменная только в Production, а деплой Preview; или не сделали Redeploy после добавления env. Vercel: All Environments или дублируйте в Preview + Production.",
    );
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN is not configured on the server." },
      { status: 503 },
    );
  }

  let body: { initData?: string; pin?: string };
  try {
    body = (await req.json()) as { initData?: string; pin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const initData = body.initData?.trim();
  if (!initData) {
    return NextResponse.json({ error: "initData is required" }, { status: 400 });
  }

  const pinRaw = body.pin?.trim() ?? "";

  if (!verifyTelegramInitData(initData, botToken)) {
    return NextResponse.json({ error: "Invalid initData signature" }, { status: 401 });
  }

  const user = parseTelegramUserFromInitData(initData);
  if (!user?.id) {
    return NextResponse.json({ error: "initData has no user" }, { status: 400 });
  }

  try {
    const telegramUserId = String(user.id);
    let profile = await prisma.profile.findUnique({
      where: { telegramUserId },
    });

    if (!profile) {
      if (!pinRaw) {
        return NextResponse.json(
          {
            error: "Укажите ПИН/ИНН для регистрации.",
            code: "PIN_REQUIRED",
          },
          { status: 400 },
        );
      }
      let pinAnchor: string;
      try {
        pinAnchor = pinAnchorFromUserInput(pinRaw);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Некорректный ПИН." },
          { status: 400 },
        );
      }
      const taken = await prisma.profile.findFirst({ where: { pinAnchor } });
      if (taken) {
        return NextResponse.json(
          { error: "Этот ПИН уже зарегистрирован.", code: "PIN_IN_USE" },
          { status: 409 },
        );
      }

      const family = await prisma.family.create({
        data: {
          name: `${buildDisplayName(user)} — үй-бүлө`,
        },
      });

      profile = await prisma.profile.create({
        data: {
          familyId: family.id,
          displayName: buildDisplayName(user),
          telegramUserId,
          telegramUsername: user.username?.trim()
            ? user.username.replace(/^@/, "").toLowerCase()
            : null,
          avatarUrl: user.photo_url ?? null,
          familyRole: FamilyRole.ADMIN,
          isManaged: false,
          pinAnchor,
        },
      });
    } else {
      if (user.photo_url && user.photo_url !== profile.avatarUrl) {
        profile = await prisma.profile.update({
          where: { id: profile.id },
          data: { avatarUrl: user.photo_url },
        });
      }

      if (user.username !== undefined) {
        const uname =
          user.username.trim() === "" ? null : user.username.replace(/^@/, "").toLowerCase();
        if (uname !== profile.telegramUsername) {
          profile = await prisma.profile.update({
            where: { id: profile.id },
            data: { telegramUsername: uname },
          });
        }
      }

      if (profile.pinAnchor == null) {
        if (!pinRaw) {
          const tokenEarly = createSessionToken({
            profileId: profile.id,
            familyId: profile.familyId,
          });
          await ensureFamilySubscription(profile.familyId);
          const resEarly = NextResponse.json({
            ok: true,
            profile: profileJson(profile),
          });
          resEarly.cookies.set(sessionCookieName(), tokenEarly, sessionCookieOptions());
          return resEarly;
        }
        let pinAnchor: string;
        try {
          pinAnchor = pinAnchorFromUserInput(pinRaw);
        } catch (e) {
          return NextResponse.json(
            { error: e instanceof Error ? e.message : "Некорректный ПИН." },
            { status: 400 },
          );
        }
        const taken = await prisma.profile.findFirst({
          where: { pinAnchor, NOT: { id: profile.id } },
        });
        if (taken) {
          return NextResponse.json(
            { error: "Этот ПИН уже привязан к другому аккаунту.", code: "PIN_IN_USE" },
            { status: 409 },
          );
        }
        profile = await prisma.profile.update({
          where: { id: profile.id },
          data: { pinAnchor },
        });
      }
    }

    await ensureFamilySubscription(profile.familyId);

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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg.includes("SESSION_SECRET")) {
      return NextResponse.json(
        { error: "SESSION_SECRET is not set on the server (min 16 characters)." },
        { status: 503 },
      );
    }
    if (msg.includes("PIN_ANCHOR_PEPPER")) {
      return NextResponse.json(
        { error: "Сервер не настроен: задайте PIN_ANCHOR_PEPPER (мин. 16 символов)." },
        { status: 503 },
      );
    }
    console.error("POST /api/auth/telegram", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
