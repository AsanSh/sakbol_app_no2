import { FamilyRole, SubjectIdCountry, SubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getPinAnchorPepper,
  pinAnchorFromNormalizedPin,
} from "@/lib/pin-subject-anchor";

/** Уникальный 15-значный синтетический ПИН для dev-профиля (только цифры). */
function syntheticDevPin(profileId: string): string {
  const digits = profileId.replace(/\D/g, "");
  return (digits + "135790864213579").slice(0, 15).padEnd(15, "0");
}

/**
 * Первый ADMIN в БД или null (прод без данных).
 * В development при отсутствии ADMIN создаёт минимальную семью — чтобы localhost работал без ручного seed.
 */
export async function getOrCreateFirstDevAdmin() {
  let existing = await prisma.profile.findFirst({
    where: { familyRole: FamilyRole.ADMIN },
    orderBy: { createdAt: "asc" },
  });

  if (existing && !existing.pinAnchor) {
    const pin = syntheticDevPin(existing.id);
    existing = await prisma.profile.update({
      where: { id: existing.id },
      data: {
        pinAnchor: pinAnchorFromNormalizedPin(pin, getPinAnchorPepper()),
        subjectIdCountry: SubjectIdCountry.KG,
      },
    });
  }

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

  const pinAnchor = pinAnchorFromNormalizedPin(
    syntheticDevPin(admin.id),
    getPinAnchorPepper(),
  );

  const withPin = await prisma.profile.update({
    where: { id: admin.id },
    data: { pinAnchor, subjectIdCountry: SubjectIdCountry.KG },
  });

  await prisma.subscription.upsert({
    where: { familyId: family.id },
    update: {},
    create: { familyId: family.id, tier: SubscriptionTier.FREE },
  });

  return withPin;
}
