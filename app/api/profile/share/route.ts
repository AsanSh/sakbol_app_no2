import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ensureInviteCode9ForAccess } from "@/lib/assign-invite-code9";

export const dynamic = "force-dynamic";

/** POST /api/profile/share
 * Body: { profileId: string; expiresInDays?: number }
 * Создаёт (или возвращает существующий) инвайт-токен для профиля.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { profileId?: string; expiresInDays?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const profileId = String(body.profileId ?? "").trim();
  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }

  // Проверяем что профиль принадлежит текущей семье
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
    select: { id: true, displayName: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const days = Number(body.expiresInDays ?? 30);
  const inviteExpiresAt = new Date(Date.now() + days * 86_400_000);

  // Ищем активный инвайт (не принятый, не отозванный, не просроченный)
  const existing = await prisma.profileAccess.findFirst({
    where: {
      sourceProfileId: profileId,
      acceptedAt: null,
      revokedAt: null,
      inviteExpiresAt: { gt: new Date() },
    },
    select: { id: true, inviteToken: true, inviteExpiresAt: true, inviteCode9: true },
  });

  if (existing) {
    const inviteCode9 =
      existing.inviteCode9 ?? (await ensureInviteCode9ForAccess(existing.id));
    return NextResponse.json({
      id: existing.id,
      inviteToken: existing.inviteToken,
      inviteCode9,
      inviteExpiresAt: existing.inviteExpiresAt,
      profileName: profile.displayName,
    });
  }

  const access = await prisma.profileAccess.create({
    data: {
      id: randomUUID(),
      sourceProfileId: profileId,
      inviteToken: randomUUID(),
      inviteExpiresAt,
      canWrite: true,
    },
    select: { id: true, inviteToken: true, inviteExpiresAt: true },
  });

  const inviteCode9 = await ensureInviteCode9ForAccess(access.id);

  return NextResponse.json({
    id: access.id,
    inviteToken: access.inviteToken,
    inviteCode9,
    inviteExpiresAt: access.inviteExpiresAt,
    profileName: profile.displayName,
  });
}

/** GET /api/profile/share  — список выданных доступов для текущей семьи */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accesses = await prisma.profileAccess.findMany({
    where: {
      sourceProfile: { familyId: session.familyId },
      revokedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      inviteToken: true,
      inviteCode9: true,
      canWrite: true,
      acceptedAt: true,
      inviteExpiresAt: true,
      createdAt: true,
      sourceProfile: { select: { id: true, displayName: true, avatarUrl: true } },
      grantee: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ accesses });
}

/** DELETE /api/profile/share?id=... — отозвать доступ */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const access = await prisma.profileAccess.findFirst({
    where: { id, sourceProfile: { familyId: session.familyId } },
    select: { id: true },
  });
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.profileAccess.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
