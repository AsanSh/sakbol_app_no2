import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET /api/profile/share/invite/[token] — информация об инвайте (без авторизации) */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token: raw } = await ctx.params;
  const token = raw?.trim();
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const access = await prisma.profileAccess.findFirst({
    where: { inviteToken: token, revokedAt: null },
    select: {
      id: true,
      acceptedAt: true,
      inviteExpiresAt: true,
      canWrite: true,
      sourceProfile: {
        select: { id: true, displayName: true, avatarUrl: true, managedRole: true },
      },
    },
  });

  if (!access) {
    return NextResponse.json({ error: "Invite not found or revoked" }, { status: 404 });
  }

  if (access.inviteExpiresAt && access.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  return NextResponse.json({
    id: access.id,
    accepted: !!access.acceptedAt,
    canWrite: access.canWrite,
    inviteExpiresAt: access.inviteExpiresAt,
    profile: access.sourceProfile,
  });
}

/** POST /api/profile/share/invite/[token] — принять приглашение */
export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token: raw } = await ctx.params;
  const token = raw?.trim();
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const access = await prisma.profileAccess.findFirst({
    where: { inviteToken: token, revokedAt: null, acceptedAt: null },
    select: {
      id: true,
      inviteExpiresAt: true,
      sourceProfileId: true,
      sourceProfile: { select: { familyId: true } },
    },
  });

  if (!access) {
    return NextResponse.json({ error: "Invite not found, revoked, or already accepted" }, { status: 404 });
  }

  if (access.inviteExpiresAt && access.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  // Нельзя принять приглашение на профиль своей же семьи
  if (access.sourceProfile.familyId === session.familyId) {
    return NextResponse.json({ error: "Cannot accept your own family's invite" }, { status: 400 });
  }

  // Проверяем — нет ли уже другого активного доступа к этому профилю от того же гостя
  const alreadyGranted = await prisma.profileAccess.findFirst({
    where: {
      sourceProfileId: access.sourceProfileId,
      granteeProfileId: session.profileId,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (alreadyGranted) {
    return NextResponse.json({ ok: true, alreadyGranted: true });
  }

  await prisma.profileAccess.update({
    where: { id: access.id },
    data: {
      granteeProfileId: session.profileId,
      acceptedAt: new Date(),
      pendingTelegramUserId: null,
    },
  });

  return NextResponse.json({ ok: true });
}
