import "server-only";

import { prisma } from "@/lib/prisma";

/** Генерирует уникальный 9-значный код и записывает в ProfileAccess. */
export async function ensureInviteCode9ForAccess(accessId: string): Promise<string> {
  const row = await prisma.profileAccess.findUnique({
    where: { id: accessId },
    select: { inviteCode9: true },
  });
  if (row?.inviteCode9) return row.inviteCode9;

  for (let attempt = 0; attempt < 50; attempt++) {
    const code = `${Math.floor(100_000_000 + Math.random() * 900_000_000)}`;
    try {
      await prisma.profileAccess.update({
        where: { id: accessId },
        data: { inviteCode9: code },
      });
      return code;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not allocate inviteCode9");
}
