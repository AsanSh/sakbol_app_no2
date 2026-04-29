import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFamilySubscription } from "@/lib/premium";
import { applyPendingProfileAccessForTelegramUser } from "@/lib/profile-access-accept";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/session";
import { verifyTelegramLoginWidgetParams } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Callback для виджета Telegram Login (браузер): та же сессия, что после Mini App, по telegramUserId.
 * В BotFather: /setdomain → домен сайта (например adventory.store).
 */
export async function GET(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken?.trim()) {
    console.error("[telegram-widget] TELEGRAM_BOT_TOKEN missing");
    return NextResponse.redirect(new URL("/login?err=server", req.url));
  }

  const verified = verifyTelegramLoginWidgetParams(req.nextUrl.searchParams, botToken);
  if (!verified.ok) {
    console.error("[telegram-widget] verify failed:", verified.error);
    return NextResponse.redirect(new URL("/login?err=telegram_widget", req.url));
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { telegramUserId: verified.telegramUserId },
    });

    if (!profile) {
      return NextResponse.redirect(new URL("/login?err=no_profile", req.url));
    }

    if (profile.telegramUserId) {
      try {
        await applyPendingProfileAccessForTelegramUser(profile.telegramUserId, profile.id);
      } catch (e) {
        console.error("[telegram-widget] applyPendingProfileAccess", e);
      }
    }

    await ensureFamilySubscription(profile.familyId);

    const token = createSessionToken({
      profileId: profile.id,
      familyId: profile.familyId,
    });

    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set(sessionCookieName(), token, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("GET /api/auth/telegram-widget", e);
    return NextResponse.redirect(new URL("/login?err=server", req.url));
  }
}
