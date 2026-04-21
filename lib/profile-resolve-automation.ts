import "server-only";

import { prisma } from "@/lib/prisma";

/** Поиск профиля для скрипта загрузки: сначала adeskId, затем ФИО (displayName). */
export async function findProfileForAutomation(input: {
  adeskId?: string | null;
  fullName?: string | null;
}) {
  const aid = input.adeskId?.trim();
  if (aid) {
    const byDesk = await prisma.profile.findFirst({ where: { adeskId: aid } });
    if (byDesk) return byDesk;
  }
  const name = input.fullName?.trim();
  if (name) {
    const exact = await prisma.profile.findFirst({
      where: { displayName: { equals: name, mode: "insensitive" } },
    });
    if (exact) return exact;
    return prisma.profile.findFirst({
      where: { displayName: { contains: name, mode: "insensitive" } },
    });
  }
  return null;
}
