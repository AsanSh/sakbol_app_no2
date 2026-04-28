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
import {
  acceptOrDeferProfileAccessInvite,
  acceptOrDeferProfileAccessInviteByCode9,
  applyPendingProfileAccessForTelegramUser,
} from "@/lib/profile-access-accept";
import { pinAnchorFromUserInput } from "@/lib/pin-subject-anchor";

export const dynamic = "force-dynamic";

function shareTokenFromInitData(initData: string): string | null {
  const raw = new URLSearchParams(initData).get("start_param")?.trim();
  if (!raw || !raw.toLowerCase().startsWith("share_")) return null;
  const token = raw.slice("share_".length).trim();
  return token.length > 0 ? token : null;
}

function joinCode9FromInitData(initData: string): string | null {
  const raw = new URLSearchParams(initData).get("start_param")?.trim();
  if (!raw || !raw.toLowerCase().startsWith("join_")) return null;
  const digits = raw.slice("join_".length).replace(/\D/g, "").slice(0, 9);
  return digits.length === 9 ? digits : null;
}

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
      "[auth/telegram] TELEGRAM_BOT_TOKEN отсутствует в runtime. Проверьте Vercel env (All Environments) и сделайте Redeploy.",
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

  const telegramUserId = String(user.id);
  const startShareToken = shareTokenFromInitData(initData);
  const startJoinCode9 = joinCode9FromInitData(initData);

  console.log("[auth/telegram] start", {
    telegramUserId,
    hasShareToken: Boolean(startShareToken),
    sharePrefix: startShareToken?.slice(0, 6) ?? null,
    hasJoinCode9: Boolean(startJoinCode9),
    hasPin: pinRaw.length > 0,
  });

  try {
    if (startShareToken) {
      const r = await acceptOrDeferProfileAccessInvite({
        inviteToken: startShareToken,
        telegramUserId,
      });
      console.log("[auth/telegram] share status", { result: r.status });
    } else if (startJoinCode9) {
      const r = await acceptOrDeferProfileAccessInviteByCode9({
        inviteCode9: startJoinCode9,
        telegramUserId,
      });
      console.log("[auth/telegram] join code status", { result: r.status });
    }

    let profile = await prisma.profile.findUnique({
      where: { telegramUserId },
    });

    if (!profile) {
      if (!pinRaw) {
        console.log("[auth/telegram] no profile + no pin → PIN_REQUIRED", {
          telegramUserId,
        });
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
        if (taken.telegramUserId && taken.telegramUserId !== telegramUserId) {
          return NextResponse.json(
            { error: "Этот ПИН уже зарегистрирован.", code: "PIN_IN_USE" },
            { status: 409 },
          );
        }
        // Существующий профиль (без telegram или с этим же telegram) — линкуем.
        profile = await prisma.profile.update({
          where: { id: taken.id },
          data: {
            telegramUserId,
            telegramUsername: user.username?.trim()
              ? user.username.replace(/^@/, "").toLowerCase()
              : taken.telegramUsername,
            avatarUrl: user.photo_url ?? taken.avatarUrl,
          },
        });
        console.log("[auth/telegram] linked existing profile by PIN", {
          profileId: profile.id,
          telegramUserId,
        });
      }

      if (!profile) {
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
        console.log("[auth/telegram] created new profile + family", {
          profileId: profile.id,
          familyId: family.id,
        });
      }
    } else {
      // Обновляем metadata.
      const photoChanged = user.photo_url && user.photo_url !== profile.avatarUrl;
      const incomingUname =
        user.username !== undefined
          ? user.username.trim() === ""
            ? null
            : user.username.replace(/^@/, "").toLowerCase()
          : undefined;
      const unameChanged = incomingUname !== undefined && incomingUname !== profile.telegramUsername;
      if (photoChanged || unameChanged) {
        profile = await prisma.profile.update({
          where: { id: profile.id },
          data: {
            ...(photoChanged ? { avatarUrl: user.photo_url ?? null } : {}),
            ...(unameChanged ? { telegramUsername: incomingUname ?? null } : {}),
          },
        });
      }

      // Юзер существует, но pinAnchor пустой — нужно завершить регистрацию.
      if (profile.pinAnchor == null) {
        if (!pinRaw) {
          // Ранний выход: даём cookie (для применения отложенных доступов в /api/family/default),
          // но фронтенд увидит needsPinCompletion и попросит ввод PIN ещё раз через CompletePinForViewer.
          await applyPendingProfileAccessForTelegramUser(telegramUserId, profile.id);
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

    const applied = await applyPendingProfileAccessForTelegramUser(telegramUserId, profile.id);
    if (applied > 0) {
      console.log("[auth/telegram] applied pending shared invites", {
        profileId: profile.id,
        applied,
      });
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
    console.error("[auth/telegram] unhandled", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
