import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function normalizeCode(raw: string): string | null {
  const d = raw.replace(/\D/g, "").slice(0, 9);
  return d.length === 9 ? d : null;
}

/** GET — информация о приглашении по 9-значному коду */
export async function GET(_req: Request, ctx: { params: { code: string } }) {
  const code = normalizeCode(ctx.params.code ?? "");
  if (!code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const access = await prisma.profileAccess.findFirst({
    where: { inviteCode9: code, revokedAt: null },
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
    inviteCode9: code,
  });
}

/** POST — принять приглашение по коду (нужна сессия) */
export async function POST(_req: Request, ctx: { params: { code: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = normalizeCode(ctx.params.code ?? "");
  if (!code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const access = await prisma.profileAccess.findFirst({
    where: { inviteCode9: code, revokedAt: null, acceptedAt: null },
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

  if (access.sourceProfile.familyId === session.familyId) {
    return NextResponse.json({ error: "Cannot accept your own family's invite" }, { status: 400 });
  }

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
