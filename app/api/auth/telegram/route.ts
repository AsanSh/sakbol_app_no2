import { FamilyRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFamilySubscription } from "@/lib/premium";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/session";
import {
  buildDisplayName,
  parseTelegramUserFromInitData,
  verifyTelegramInitData,
} from "@/lib/telegram-init-data";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN is not configured on the server." },
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
    return NextResponse.json({ error: "Invalid initData signature" }, { status: 401 });
  }

  const user = parseTelegramUserFromInitData(initData);
  if (!user?.id) {
    return NextResponse.json({ error: "initData has no user" }, { status: 400 });
  }

  const telegramUserId = String(user.id);
  let profile = await prisma.profile.findUnique({
    where: { telegramUserId },
  });

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
        avatarUrl: user.photo_url ?? null,
        familyRole: FamilyRole.ADMIN,
        isManaged: false,
      },
    });
  } else if (user.photo_url && user.photo_url !== profile.avatarUrl) {
    profile = await prisma.profile.update({
      where: { id: profile.id },
      data: { avatarUrl: user.photo_url },
    });
  }
  await ensureFamilySubscription(profile.familyId);

  const token = createSessionToken({
    profileId: profile.id,
    familyId: profile.familyId,
  });

  const res = NextResponse.json({
    ok: true,
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      familyRole: profile.familyRole,
      familyId: profile.familyId,
    },
  });

  res.cookies.set(sessionCookieName(), token, sessionCookieOptions());
  return res;
}
