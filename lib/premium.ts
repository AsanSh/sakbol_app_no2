import { SubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const FREE_MAX_ANALYSES = 3;
export const FREE_MAX_PROFILES = 1;

export async function getFamilyTier(familyId: string): Promise<SubscriptionTier> {
  const s = await prisma.subscription.findUnique({ where: { familyId } });
  return s?.tier ?? SubscriptionTier.FREE;
}

export async function ensureFamilySubscription(familyId: string) {
  return prisma.subscription.upsert({
    where: { familyId },
    update: {},
    create: { familyId, tier: SubscriptionTier.FREE },
  });
}
