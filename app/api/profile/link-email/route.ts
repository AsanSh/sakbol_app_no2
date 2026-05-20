import { NextRequest, NextResponse } from "next/server";
import { EMAIL_RE, normalizeEmail } from "@/lib/auth-email";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Привязать email и пароль к текущему профилю (вход на сайт без Telegram). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Укажите корректный email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Пароль не короче 8 символов." }, { status: 400 });
  }

  const profile = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (profile.passwordHash) {
    return NextResponse.json(
      { error: "Пароль для входа уже задан. Используйте вход по email на сайте." },
      { status: 409 },
    );
  }

  const taken = await prisma.profile.findFirst({
    where: { email, NOT: { id: profile.id } },
  });
  if (taken) {
    return NextResponse.json({ error: "Этот email уже используется другим аккаунтом." }, { status: 409 });
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      email,
      passwordHash: hashPassword(password),
    },
  });

  return NextResponse.json({ ok: true, email });
}
