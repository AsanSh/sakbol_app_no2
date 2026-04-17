import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFamilySubscription } from "@/lib/premium";
import { verifyPassword } from "@/lib/password";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/session";

export const dynamic = "force-dynamic";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Нужны email и пароль." }, { status: 400 });
  }

  const profile = await prisma.profile.findFirst({
    where: { email, passwordHash: { not: null } },
  });

  if (!profile?.passwordHash || !verifyPassword(password, profile.passwordHash)) {
    return NextResponse.json({ error: "Неверный email или пароль." }, { status: 401 });
  }

  try {
    await ensureFamilySubscription(profile.familyId);
  } catch (e) {
    console.error("[login-email] ensureFamilySubscription", e);
  }

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
      needsPinCompletion: profile.pinAnchor == null,
    },
  });
  res.cookies.set(sessionCookieName(), token, sessionCookieOptions());
  return res;
}
