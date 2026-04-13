"use server";

import { FamilyRole, type ManagedRelationRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { FREE_MAX_PROFILES, getFamilyTier } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type CreateManagedProfileInput = {
  displayName: string;
  managedRole: ManagedRelationRole;
  /** ISO date string yyyy-mm-dd or empty */
  dateOfBirth?: string | null;
  avatarUrl?: string | null;
};

export async function createManagedProfile(input: CreateManagedProfileInput) {
  const session = getSession();
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

  let dateOfBirth: Date | null = null;
  if (input.dateOfBirth?.trim()) {
    const d = new Date(input.dateOfBirth.trim());
    if (Number.isNaN(d.getTime())) {
      return { ok: false as const, error: "Invalid date of birth." };
    }
    dateOfBirth = d;
  }

  const profile = await prisma.profile.create({
    data: {
      familyId: session.familyId,
      displayName: name,
      avatarUrl: input.avatarUrl?.trim() || null,
      isManaged: true,
      telegramUserId: null,
      familyRole: FamilyRole.MEMBER,
      managedRole: input.managedRole,
      dateOfBirth,
    },
    select: { id: true, displayName: true },
  });

  revalidatePath("/");
  return { ok: true as const, profile };
}

export async function getFamilyMembers() {
  const session = getSession();
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
    },
  });
}
