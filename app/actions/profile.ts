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
