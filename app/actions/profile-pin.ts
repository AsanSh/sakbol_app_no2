"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { pinAnchorFromUserInput } from "@/lib/pin-subject-anchor";

/**
 * Завершить профиль: сохранить якорь ПИН для текущего пользователя (Telegram после миграции и т.п.).
 * Сырой ПИН на сервере не логируем.
 */
export async function setOwnProfilePin(rawPin: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = getSession();
  if (!session) {
    return { ok: false, error: "Не авторизованы." };
  }

  let pinAnchor: string;
  try {
    pinAnchor = pinAnchorFromUserInput(rawPin);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Некорректный ПИН." };
  }

  const me = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
    select: { id: true, pinAnchor: true },
  });
  if (!me) {
    return { ok: false, error: "Профиль не найден." };
  }
  if (me.pinAnchor) {
    return { ok: false, error: "ПИН для этого профиля уже сохранён." };
  }

  const taken = await prisma.profile.findFirst({
    where: { pinAnchor, NOT: { id: me.id } },
    select: { id: true },
  });
  if (taken) {
    return { ok: false, error: "Этот ПИН уже привязан к другому аккаунту." };
  }

  try {
    await prisma.profile.update({
      where: { id: me.id },
      data: { pinAnchor },
    });
  } catch {
    return { ok: false, error: "Не удалось сохранить ПИН. Попробуйте ещё раз." };
  }

  revalidatePath("/");
  return { ok: true };
}
