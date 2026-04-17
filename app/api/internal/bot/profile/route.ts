import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Данные профиля по telegram_user_id для серверного бота / интеграций.
 * Заголовок: Authorization: Bearer <BOT_INTERNAL_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.BOT_INTERNAL_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "BOT_INTERNAL_SECRET not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization")?.trim();
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const telegramUserId = req.nextUrl.searchParams.get("telegram_user_id")?.trim();
  if (!telegramUserId || !/^\d+$/.test(telegramUserId)) {
    return NextResponse.json({ error: "telegram_user_id required (digits)" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { telegramUserId },
    include: {
      family: { select: { id: true, name: true } },
      _count: { select: { healthRecords: true, medications: true } },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      email: profile.email,
      familyId: profile.familyId,
      familyName: profile.family.name,
      familyRole: profile.familyRole,
      analysesCount: profile._count.healthRecords,
      medicationsCount: profile._count.medications,
    },
  });
}
