import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function maskDigits(d: string): string {
  if (d.length <= 4) return "****";
  return `${d.slice(0, 3)}…${d.slice(-4)}`;
}

/** Статус резервного входа на сайт (email/пароль или телефон для OTP). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
    select: {
      email: true,
      passwordHash: true,
      webLoginPhoneDigits: true,
      telegramUserId: true,
    },
  });
  if (!p) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasEmailLogin = Boolean(p.email && p.passwordHash);
  const hasWebPhone = Boolean(p.webLoginPhoneDigits);

  return NextResponse.json({
    hasEmailLogin,
    hasWebPhone,
    email: hasEmailLogin ? p.email : null,
    phoneMasked: p.webLoginPhoneDigits ? maskDigits(p.webLoginPhoneDigits) : null,
    hasTelegram: Boolean(p.telegramUserId),
    needsBackup: !hasEmailLogin && !hasWebPhone,
  });
}
