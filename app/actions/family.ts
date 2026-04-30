"use server";

import {
  BiologicalSex,
  FamilyRole,
  SubjectIdCountry,
  type ManagedRelationRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { FREE_MAX_PROFILES, getFamilyTier } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  dateOfBirthFromKg14Pin,
  pinAnchorFromUserInput,
} from "@/lib/pin-subject-anchor";
import { normalizeSubjectIdDigits } from "@/lib/subject-id-country";

export type CreateManagedProfileInput = {
  displayName: string;
  managedRole: ManagedRelationRole;
  avatarUrl?: string | null;
  biologicalSex?: BiologicalSex;
  /** Страна идентификатора; по умолчанию Кыргызстан */
  subjectIdCountry?: SubjectIdCountry;
  /** Гос. номер: на сервер только HMAC; для KG и 14 цифр — дата из ПИН */
  pin: string;
};

export async function createManagedProfile(input: CreateManagedProfileInput) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const name = input.displayName.trim();
  if (!name) {
    return { ok: false as const, error: "Display name is required." };
  }

  const actor = await prisma.profile.findFirst({
    where: {
      id: session.profileId,
      familyId: session.familyId,
      familyRole: FamilyRole.ADMIN,
    },
  });

  if (!actor) {
    return {
      ok: false as const,
      error: "Only family administrators can add managed relatives.",
    };
  }

  const tier = await getFamilyTier(session.familyId);
  const profileCount = await prisma.profile.count({
    where: { familyId: session.familyId },
  });
  if (tier !== "PREMIUM" && profileCount >= FREE_MAX_PROFILES) {
    return {
      ok: false as const,
      error: "Premium required: free plan supports only 1 family profile.",
    };
  }

  const country = input.subjectIdCountry ?? SubjectIdCountry.KG;

  let pinAnchor: string;
  try {
    pinAnchor = pinAnchorFromUserInput(input.pin, country);
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Некорректный ПИН.",
    };
  }

  const normalizedPin = normalizeSubjectIdDigits(input.pin);
  const dateOfBirth =
    country === SubjectIdCountry.KG ? dateOfBirthFromKg14Pin(normalizedPin) : null;

  const taken = await prisma.profile.findFirst({
    where: { pinAnchor },
    select: { id: true },
  });
  if (taken) {
    return { ok: false as const, error: "Этот ПИН уже используется в системе." };
  }

  const profile = await prisma.profile.create({
    data: {
      familyId: session.familyId,
      displayName: name,
      avatarUrl: input.avatarUrl?.trim() || null,
      pinAnchor,
      subjectIdCountry: country,
      isManaged: true,
      telegramUserId: null,
      familyRole: FamilyRole.MEMBER,
      managedRole: input.managedRole,
      dateOfBirth,
      biologicalSex: input.biologicalSex ?? BiologicalSex.UNKNOWN,
    },
    select: { id: true, displayName: true },
  });

  revalidatePath("/");
  return { ok: true as const, profile };
}

/** Удаление добавленного члена семьи (карточка без своего Telegram). Только ADMIN. */
export async function deleteManagedProfile(profileId: string) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Требуется вход." };
  }

  const actor = await prisma.profile.findFirst({
    where: {
      id: session.profileId,
      familyId: session.familyId,
      familyRole: FamilyRole.ADMIN,
    },
  });
  if (!actor) {
    return {
      ok: false as const,
      error: "Только администратор семьи может удалить карточку члена семьи.",
    };
  }

  const target = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
    select: { id: true, isManaged: true, familyRole: true },
  });
  if (!target) {
    return { ok: false as const, error: "Профиль не найден." };
  }
  if (!target.isManaged) {
    return {
      ok: false as const,
      error:
        "Можно удалить только добавленного родственника (без собственного входа в приложение).",
    };
  }
  if (target.familyRole === FamilyRole.ADMIN) {
    return { ok: false as const, error: "Нельзя удалить администратора семьи." };
  }

  await prisma.profile.delete({ where: { id: profileId } });

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function getFamilyMembers() {
  const session = await getSession();
  if (!session) return [];

  return prisma.profile.findMany({
    where: { familyId: session.familyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      familyRole: true,
      isManaged: true,
      telegramUserId: true,
      managedRole: true,
      dateOfBirth: true,
      biologicalSex: true,
      heightCm: true,
      weightKg: true,
      bloodType: true,
      medCardIsDoctor: true,
      medCardDoctorNote: true,
      medCardIsCaregiver: true,
      medCardCaregiverNote: true,
    },
  });
}

/** Только для карточных профилей: смена «кто это» (дочь, супруг и т.д.). */
export async function updateManagedProfileKinship(
  profileId: string,
  managedRole: ManagedRelationRole,
) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Требуется вход." };
  }

  const actor = await prisma.profile.findFirst({
    where: {
      id: session.profileId,
      familyId: session.familyId,
      familyRole: FamilyRole.ADMIN,
    },
  });
  if (!actor) {
    return {
      ok: false as const,
      error: "Только администратор семьи может менять родство.",
    };
  }

  const target = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
    select: { id: true, isManaged: true },
  });
  if (!target) {
    return { ok: false as const, error: "Профиль не найден." };
  }
  if (!target.isManaged) {
    return {
      ok: false as const,
      error: "Родство задаётся только для добавленных членов семьи.",
    };
  }

  await prisma.profile.update({
    where: { id: profileId },
    data: { managedRole },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const };
}

/** Смена гос. идентификатора у карточного члена семьи. Только ADMIN. */
export async function updateManagedMemberSubjectId(
  profileId: string,
  input: { pin: string; subjectIdCountry: SubjectIdCountry },
) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Требуется вход." };
  }

  const actor = await prisma.profile.findFirst({
    where: {
      id: session.profileId,
      familyId: session.familyId,
      familyRole: FamilyRole.ADMIN,
    },
  });
  if (!actor) {
    return {
      ok: false as const,
      error: "Только администратор семьи может изменить идентификатор.",
    };
  }

  const target = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
    select: { id: true, isManaged: true },
  });
  if (!target) {
    return { ok: false as const, error: "Профиль не найден." };
  }
  if (!target.isManaged) {
    return {
      ok: false as const,
      error: "Идентификатор этого профиля меняет сам пользователь в настройках.",
    };
  }

  let pinAnchor: string;
  try {
    pinAnchor = pinAnchorFromUserInput(input.pin, input.subjectIdCountry);
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Некорректный номер.",
    };
  }

  const normalizedPin = normalizeSubjectIdDigits(input.pin);
  const dateOfBirth =
    input.subjectIdCountry === SubjectIdCountry.KG
      ? dateOfBirthFromKg14Pin(normalizedPin)
      : null;

  const taken = await prisma.profile.findFirst({
    where: { pinAnchor, NOT: { id: profileId } },
    select: { id: true },
  });
  if (taken) {
    return {
      ok: false as const,
      error: "Этот идентификатор уже используется другим аккаунтом.",
    };
  }

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      pinAnchor,
      subjectIdCountry: input.subjectIdCountry,
      ...(dateOfBirth ? { dateOfBirth } : {}),
    },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const };
}
