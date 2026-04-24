import "server-only";

import type { SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export type ProfileAccessCheck = {
  ok: boolean;
  isOwnerFamily: boolean;
  canWrite: boolean;
};

/** Can the current session read/write selected profile data? Own family always can read/write. */
export async function checkProfileAccess(
  session: SessionPayload,
  profileId: string,
): Promise<ProfileAccessCheck> {
  const own = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
    select: { id: true },
  });
  if (own) {
    return { ok: true, isOwnerFamily: true, canWrite: true };
  }

  const guest = await prisma.profileAccess.findFirst({
    where: {
      sourceProfileId: profileId,
      granteeProfileId: session.profileId,
      acceptedAt: { not: null },
      revokedAt: null,
      OR: [{ inviteExpiresAt: null }, { inviteExpiresAt: { gt: new Date() } }],
    },
    select: { canWrite: true },
  });

  if (!guest) {
    return { ok: false, isOwnerFamily: false, canWrite: false };
  }
  return { ok: true, isOwnerFamily: false, canWrite: guest.canWrite };
}
