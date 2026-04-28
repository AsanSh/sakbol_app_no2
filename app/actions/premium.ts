"use server";

import { SubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function activatePremiumStub(method: "MBANK" | "MegaPay") {
  const s = await getSession();
  if (!s) return { ok: false as const, error: "Unauthorized" };
  await new Promise((r) => setTimeout(r, 80));
  await prisma.subscription.upsert({
    where: { familyId: s.familyId },
    update: { tier: SubscriptionTier.PREMIUM },
    create: { familyId: s.familyId, tier: SubscriptionTier.PREMIUM },
  });
  return { ok: true as const, method };
}
