"use server";

import { BiologicalSex, FamilyRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function updateProfileBiologicalSex(
  profileId: string,
  sex: BiologicalSex,
) {
  const session = getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const actor = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
  });
  if (!actor) {
    return { ok: false as const, error: "Actor not found." };
  }

  const target = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
  });
  if (!target) {
    return { ok: false as const, error: "Profile not found." };
  }

  const isSelf = target.id === actor.id;
  const isAdmin = actor.familyRole === FamilyRole.ADMIN;
  if (!isSelf && !isAdmin) {
    return { ok: false as const, error: "Only admin or self can update." };
  }

  await prisma.profile.update({
    where: { id: profileId },
    data: { biologicalSex: sex },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function updateProfileVitals(
  profileId: string,
  input: {
    heightCm: number | null;
    weightKg: number | null;
    bloodType: string | null;
  },
) {
  const session = getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const actor = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
  });
  if (!actor) {
    return { ok: false as const, error: "Actor not found." };
  }

  const target = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
  });
  if (!target) {
    return { ok: false as const, error: "Profile not found." };
  }

  const isSelf = target.id === actor.id;
  const isAdmin = actor.familyRole === FamilyRole.ADMIN;
  if (!isSelf && !isAdmin) {
    return { ok: false as const, error: "Only admin or self can update." };
  }

  const heightCm = input.heightCm;
  const weightKg = input.weightKg;
  if (heightCm != null) {
    if (!Number.isFinite(heightCm) || heightCm < 40 || heightCm > 272) {
      return { ok: false as const, error: "Рост: укажите значение 40–272 см." };
    }
  }
  if (weightKg != null) {
    if (!Number.isFinite(weightKg) || weightKg < 15 || weightKg > 500) {
      return { ok: false as const, error: "Вес: укажите значение 15–500 кг." };
    }
  }

  const bloodRaw = input.bloodType?.trim() ?? "";
  const bloodType = bloodRaw.length > 0 ? bloodRaw.slice(0, 32) : null;

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      heightCm,
      weightKg,
      bloodType,
    },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const };
}

/** Имя и возраст для любого профиля семьи: сам пользователь или админ. */
export async function updateMemberProfileBasics(
  profileId: string,
  input: {
    displayName: string;
    ageYears: number | null;
  },
) {
  const session = getSession();
  if (!session) {
    return { ok: false as const, error: "Требуется вход." };
  }

  const actor = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
    select: { id: true, familyRole: true },
  });
  if (!actor) {
    return { ok: false as const, error: "Профиль не найден." };
  }

  const target = await prisma.profile.findFirst({
    where: { id: profileId, familyId: session.familyId },
    select: { id: true },
  });
  if (!target) {
    return { ok: false as const, error: "Участник не найден." };
  }

  const isSelf = target.id === actor.id;
  const isAdmin = actor.familyRole === FamilyRole.ADMIN;
  if (!isSelf && !isAdmin) {
    return {
      ok: false as const,
      error: "Редактировать других может только администратор семьи.",
    };
  }

  const displayName = input.displayName.trim();
  if (!displayName) {
    return { ok: false as const, error: "Имя не может быть пустым." };
  }
  if (displayName.length > 80) {
    return { ok: false as const, error: "Имя слишком длинное." };
  }

  let dateOfBirth: Date | null = null;
  if (typeof input.ageYears === "number") {
    if (!Number.isFinite(input.ageYears) || input.ageYears < 0 || input.ageYears > 120) {
      return { ok: false as const, error: "Возраст должен быть в диапазоне 0..120." };
    }
    const now = new Date();
    const y = now.getFullYear() - Math.floor(input.ageYears);
    dateOfBirth = new Date(Date.UTC(y, 6, 1, 0, 0, 0));
  }

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      displayName,
      dateOfBirth,
    },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function updateOwnProfileBasics(input: {
  displayName: string;
  ageYears: number | null;
}) {
  const session = getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const actor = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
    select: { id: true },
  });
  if (!actor) {
    return { ok: false as const, error: "Actor not found." };
  }

  const displayName = input.displayName.trim();
  if (!displayName) {
    return { ok: false as const, error: "Имя не может быть пустым." };
  }
  if (displayName.length > 80) {
    return { ok: false as const, error: "Имя слишком длинное." };
  }

  let dateOfBirth: Date | null = null;
  if (typeof input.ageYears === "number") {
    if (!Number.isFinite(input.ageYears) || input.ageYears < 0 || input.ageYears > 120) {
      return { ok: false as const, error: "Возраст должен быть в диапазоне 0..120." };
    }
    const now = new Date();
    const y = now.getFullYear() - Math.floor(input.ageYears);
    // Упрощенно фиксируем на 1 июля, чтобы избегать timezone/off-by-one сюрпризов.
    dateOfBirth = new Date(Date.UTC(y, 6, 1, 0, 0, 0));
  }

  await prisma.profile.update({
    where: { id: actor.id },
    data: {
      displayName,
      dateOfBirth,
    },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const };
}
