import { NextRequest, NextResponse } from "next/server";
import { normalizeWebLoginPhoneDigits } from "@/lib/login-phone-digits";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function maskDigits(d: string): string {
  if (d.length <= 4) return "****";
  return `${d.slice(0, 3)}…${d.slice(-4)}`;
}

/** Сохранённый для входа на сайт номер (тот же, что планируете ввести на /login). */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
    select: { webLoginPhoneDigits: true, telegramUserId: true },
  });
  if (!p) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const d = p.webLoginPhoneDigits;
  return NextResponse.json({
    has: Boolean(d),
    masked: d ? maskDigits(d) : null,
    needsTelegram: !p.telegramUserId,
  });
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { phone?: string; clear?: boolean };
  try {
    body = (await req.json()) as { phone?: string; clear?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.clear) {
    await prisma.profile.update({
      where: { id: session.profileId },
      data: { webLoginPhoneDigits: null },
    });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const norm = normalizeWebLoginPhoneDigits(body.phone?.trim() ?? "");
  if (!norm) {
    return NextResponse.json(
      { error: "Введите номер в международном формате (например +996… или 0 5…), без лишнего." },
      { status: 400 },
    );
  }

  const taken = await prisma.profile.findFirst({
    where: { webLoginPhoneDigits: norm, NOT: { id: session.profileId } },
  });
  if (taken) {
    return NextResponse.json(
      { error: "Этот номер уже привязан к другому аккаунту." },
      { status: 409 },
    );
  }

  await prisma.profile.update({
    where: { id: session.profileId },
    data: { webLoginPhoneDigits: norm },
  });

  return NextResponse.json({ ok: true, masked: maskDigits(norm) });
}
