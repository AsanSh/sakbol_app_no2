import { FamilyRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFamilySubscription } from "@/lib/premium";
import { pinAnchorFromUserInput } from "@/lib/pin-subject-anchor";
import { hashPassword } from "@/lib/password";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/session";

export const dynamic = "force-dynamic";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; displayName?: string; pin?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  const displayName = body.displayName?.trim() ?? "";
  const pinRaw = body.pin?.trim() ?? "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Укажите корректный email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Пароль не короче 8 символов." }, { status: 400 });
  }
  if (displayName.length < 2) {
    return NextResponse.json({ error: "Укажите имя или отображаемое имя." }, { status: 400 });
  }
  if (!pinRaw) {
    return NextResponse.json({ error: "Укажите ПИН/ИНН (как при регистрации в приложении)." }, { status: 400 });
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

  const takenPin = await prisma.profile.findFirst({ where: { pinAnchor } });
  if (takenPin) {
    return NextResponse.json({ error: "Этот ПИН уже зарегистрирован." }, { status: 409 });
  }

  const exists = await prisma.profile.findFirst({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email уже занят." }, { status: 409 });
  }

  try {
    const passwordHash = hashPassword(password);
    const family = await prisma.family.create({
      data: { name: `${displayName} — үй-бүлө` },
    });

    const profile = await prisma.profile.create({
      data: {
        familyId: family.id,
        displayName,
        email,
        passwordHash,
        telegramUserId: null,
        familyRole: FamilyRole.ADMIN,
        isManaged: false,
        pinAnchor,
      },
    });

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
        email: profile.email,
        familyId: profile.familyId,
      },
    });
    res.cookies.set(sessionCookieName(), token, sessionCookieOptions());
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка сервера";
    console.error("POST /api/auth/register-email", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
