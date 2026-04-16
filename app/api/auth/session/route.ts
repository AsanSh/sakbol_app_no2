import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Текущая сессия (cookie) — для веба без Telegram initData. */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      familyRole: true,
      familyId: true,
      pinAnchor: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      familyRole: profile.familyRole,
      familyId: profile.familyId,
      needsPinCompletion: profile.pinAnchor == null,
    },
  });
}
