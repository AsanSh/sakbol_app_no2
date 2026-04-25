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
 * Применяет share-токен из Telegram initData к уже залогиненному (через cookie) пользователю.
 * Гарантирует, что shared-профиль появится в переключателе сразу после возврата из QR-сценария
 * без необходимости полного пересоздания сессии.
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

  const shareToken = shareTokenFromInitData(initData);
  if (!shareToken) {
    return NextResponse.json({ ok: true, applied: false, reason: "no_share_param" });
  }

  const telegramUserId = String(user.id);

  try {
    console.log("[profile-access apply-from-init] applying share token", {
      tokenPrefix: shareToken.slice(0, 6),
      tokenLength: shareToken.length,
      telegramUserId,
    });

    const result = await acceptOrDeferProfileAccessInvite({
      inviteToken: shareToken,
      telegramUserId,
    });

    const profile = await prisma.profile.findUnique({
      where: { telegramUserId },
      select: { id: true },
    });
    if (profile) {
      const applied = await applyPendingProfileAccessForTelegramUser(
        telegramUserId,
        profile.id,
      );
      return NextResponse.json({
        ok: true,
        applied: true,
        status: result.status,
        appliedPendingCount: applied,
      });
    }

    return NextResponse.json({
      ok: true,
      applied: false,
      status: result.status,
      reason: "no_profile_for_telegram",
    });
  } catch (e) {
    console.error("[profile-access apply-from-init]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
