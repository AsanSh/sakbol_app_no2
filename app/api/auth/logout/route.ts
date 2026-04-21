import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Завершение сессии: удаляет session-cookie.
 *
 * Работает и для email-пароля, и для Telegram OTP — клиент один и тот же.
 * Внутри Telegram Mini App сам клиент кэширует initData, но наша серверная
 * сессия после logout становится недействительной, так что повторный вход
 * снова пройдёт через /api/auth/telegram (или email).
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
