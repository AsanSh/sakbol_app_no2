import { NextRequest, NextResponse } from "next/server";
import {
  acceptOrDeferProfileAccessInvite,
  applyPendingProfileAccessForTelegramUser,
} from "@/lib/profile-access-accept";
import { prisma } from "@/lib/prisma";
import { verifyTelegramInitData } from "@/lib/telegram";
import { parseTelegramUserFromInitData } from "@/lib/telegram-init-data";

export const dynamic = "force-dynamic";

function shareTokenFromInitData(initData: string): string | null {
  const raw = new URLSearchParams(initData).get("start_param")?.trim();
  if (!raw || !raw.toLowerCase().startsWith("share_")) return null;
  const token = raw.slice("share_".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * «Догнать» совместные доступы для Telegram-юзера в Mini App.
 *
 * 1) Если в `start_param` пришёл share-токен — обработать его (accept или defer).
 * 2) В любом случае: найти **все** отложенные приглашения для этого Telegram ID и
 *    применить их к существующему профилю. Это решает кейс, когда `start_param` не
 *    дошёл до Mini App, но `pendingTelegramUserId` был записан webhook-ом или
 *    предыдущим визитом.
 *
 * Идемпотентно. Можно вызывать с фронтенда сколько угодно раз.
 */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN is not configured" },
      { status: 503 },
    );
  }

  let body: { initData?: string };
  try {
    body = (await req.json()) as { initData?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const initData = body.initData?.trim();
  if (!initData) {
    return NextResponse.json({ error: "initData is required" }, { status: 400 });
  }

  if (!verifyTelegramInitData(initData, botToken)) {
    return NextResponse.json(
      { error: "Invalid initData signature" },
      { status: 401 },
    );
  }

  const user = parseTelegramUserFromInitData(initData);
  if (!user?.id) {
    return NextResponse.json({ error: "initData has no user" }, { status: 400 });
  }

  const telegramUserId = String(user.id);
  const shareToken = shareTokenFromInitData(initData);

  try {
    let acceptStatus: string | null = null;
    let acceptedSourceName: string | null = null;
    if (shareToken) {
      console.log("[apply-from-init] processing share token", {
        tokenPrefix: shareToken.slice(0, 6),
        telegramUserId,
      });
      const r = await acceptOrDeferProfileAccessInvite({
        inviteToken: shareToken,
        telegramUserId,
      });
      acceptStatus = r.status;
      acceptedSourceName = "sourceName" in r ? r.sourceName : null;
    }

    const profile = await prisma.profile.findUnique({
      where: { telegramUserId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({
        ok: true,
        hasShareToken: Boolean(shareToken),
        acceptStatus,
        acceptedSourceName,
        appliedPendingCount: 0,
        reason: "no_profile_for_telegram",
      });
    }

    const applied = await applyPendingProfileAccessForTelegramUser(
      telegramUserId,
      profile.id,
    );

    if (applied > 0) {
      console.log("[apply-from-init] applied pending invites", {
        profileId: profile.id,
        applied,
      });
    }

    const pendingCount = await prisma.profileAccess.count({
      where: { pendingTelegramUserId: telegramUserId, granteeProfileId: null },
    });
    const acceptedCount = await prisma.profileAccess.count({
      where: { granteeProfileId: profile.id, acceptedAt: { not: null }, revokedAt: null },
    });

    return NextResponse.json({
      ok: true,
      hasShareToken: Boolean(shareToken),
      acceptStatus,
      acceptedSourceName,
      appliedPendingCount: applied,
      stillPendingCount: pendingCount,
      acceptedAccessCount: acceptedCount,
    });
  } catch (e) {
    console.error("[apply-from-init]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
