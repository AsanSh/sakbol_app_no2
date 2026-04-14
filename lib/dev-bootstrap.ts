import { FamilyRole, SubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Первый ADMIN в БД или null (прод без данных).
 * В development при отсутствии ADMIN создаёт минимальную семью — чтобы localhost работал без ручного seed.
 */
export async function getOrCreateFirstDevAdmin() {
  const existing = await prisma.profile.findFirst({
    where: { familyRole: FamilyRole.ADMIN },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const family = await prisma.family.create({
    data: { name: "Локалдык demo үй-бүлө" },
  });

  const admin = await prisma.profile.create({
    data: {
      familyId: family.id,
      displayName: "Demo Admin",
      telegramUserId: null,
      avatarUrl: null,
      familyRole: FamilyRole.ADMIN,
      isManaged: false,
    },
  });

  await prisma.subscription.upsert({
    where: { familyId: family.id },
    update: {},
    create: { familyId: family.id, tier: SubscriptionTier.FREE },
  });

  return admin;
}
