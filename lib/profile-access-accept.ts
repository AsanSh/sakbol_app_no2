import "server-only";

import { prisma } from "@/lib/prisma";

type AcceptResult =
  | { status: "accepted"; sourceName: string }
  | { status: "pending_registration"; sourceName: string }
  | { status: "already_accepted"; sourceName: string }
  | { status: "already_has_access"; sourceName: string }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "revoked" }
  | { status: "same_family" }
  | { status: "busy_other_user" };

/**
 * Принять приглашение по токену для профиля с Telegram (бот /start share_).
 */
export async function acceptOrDeferProfileAccessInvite(input: {
  inviteToken: string;
  telegramUserId: string;
}): Promise<AcceptResult> {
  const { inviteToken, telegramUserId } = input;
  const now = new Date();

  const access = await prisma.profileAccess.findFirst({
    where: { inviteToken, revokedAt: null },
    include: { sourceProfile: { select: { id: true, familyId: true, displayName: true } } },
  });

  if (!access) {
    return { status: "invalid" };
  }

  if (access.inviteExpiresAt && access.inviteExpiresAt < now) {
    return { status: "expired" };
  }

  const sourceName = access.sourceProfile.displayName;

  if (access.acceptedAt && access.granteeProfileId) {
    const g = await prisma.profile.findUnique({
      where: { id: access.granteeProfileId },
      select: { telegramUserId: true },
    });
    if (g?.telegramUserId === telegramUserId) {
      if (access.pendingTelegramUserId) {
        await prisma.profileAccess
          .update({
            where: { id: access.id },
            data: { pendingTelegramUserId: null },
          })
          .catch(() => {});
      }
      return { status: "already_accepted", sourceName };
    }
    return { status: "busy_other_user" };
  }

  const grantee = await prisma.profile.findUnique({
    where: { telegramUserId },
    select: { id: true, familyId: true },
  });

  if (!grantee) {
    await prisma.profileAccess.update({
      where: { id: access.id },
      data: { pendingTelegramUserId: telegramUserId },
    });
    return { status: "pending_registration", sourceName };
  }

  if (access.sourceProfile.familyId === grantee.familyId) {
    return { status: "same_family" };
  }

  const already = await prisma.profileAccess.findFirst({
    where: {
      sourceProfileId: access.sourceProfileId,
      granteeProfileId: grantee.id,
      revokedAt: null,
      acceptedAt: { not: null },
    },
  });

  if (already) {
    if (already.id === access.id) {
      return { status: "already_accepted", sourceName };
    }
    return { status: "already_has_access", sourceName };
  }

  await prisma.profileAccess.update({
    where: { id: access.id },
    data: {
      granteeProfileId: grantee.id,
      acceptedAt: now,
      pendingTelegramUserId: null,
    },
  });

  return { status: "accepted", sourceName };
}

/**
 * То же, что acceptOrDeferProfileAccessInvite, но по 9-значному коду (join_… в боте / Mini App).
 */
export async function acceptOrDeferProfileAccessInviteByCode9(input: {
  inviteCode9: string;
  telegramUserId: string;
}): Promise<AcceptResult> {
  const raw = input.inviteCode9.replace(/\D/g, "").slice(0, 9);
  if (raw.length !== 9) {
    return { status: "invalid" };
  }
  const access = await prisma.profileAccess.findFirst({
    where: { inviteCode9: raw, revokedAt: null },
    include: { sourceProfile: { select: { id: true, familyId: true, displayName: true } } },
  });
  if (!access) {
    return { status: "invalid" };
  }
  return acceptOrDeferProfileAccessInvite({
    inviteToken: access.inviteToken,
    telegramUserId: input.telegramUserId,
  });
}

/**
 * После первого входа / регистрации в Mini App — применить отложенные приглашения.
 * @returns количество подключённых доступов
 */
export async function applyPendingProfileAccessForTelegramUser(
  telegramUserId: string,
  granteeProfileId: string,
): Promise<number> {
  const grantee = await prisma.profile.findUnique({
    where: { id: granteeProfileId },
    select: { familyId: true, telegramUserId: true },
  });
  if (!grantee || grantee.telegramUserId !== telegramUserId) {
    return 0;
  }

  const now = new Date();
  const pendings = await prisma.profileAccess.findMany({
    where: {
      pendingTelegramUserId: telegramUserId,
      granteeProfileId: null,
      acceptedAt: null,
      revokedAt: null,
      OR: [{ inviteExpiresAt: null }, { inviteExpiresAt: { gt: now } }],
    },
  });

  let n = 0;
  for (const row of pendings) {
    const source = await prisma.profile.findUnique({
      where: { id: row.sourceProfileId },
      select: { familyId: true },
    });
    if (!source || source.familyId === grantee.familyId) {
      await prisma.profileAccess
        .update({
          where: { id: row.id },
          data: { pendingTelegramUserId: null },
        })
        .catch(() => {});
      continue;
    }

    const already = await prisma.profileAccess.findFirst({
      where: {
        sourceProfileId: row.sourceProfileId,
        granteeProfileId,
        revokedAt: null,
        acceptedAt: { not: null },
        NOT: { id: row.id },
      },
    });
    if (already) {
      await prisma.profileAccess
        .update({
          where: { id: row.id },
          data: { pendingTelegramUserId: null, revokedAt: now },
        })
        .catch(() => {});
      continue;
    }

    await prisma.profileAccess.update({
      where: { id: row.id },
      data: {
        granteeProfileId,
        acceptedAt: now,
        pendingTelegramUserId: null,
      },
    });
    n += 1;
  }

  return n;
}
