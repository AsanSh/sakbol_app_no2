"use server";

import { SubjectIdCountry } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  dateOfBirthFromKg14Pin,
  pinAnchorFromUserInput,
} from "@/lib/pin-subject-anchor";
import { normalizeSubjectIdDigits } from "@/lib/subject-id-country";

/**
 * Первичная привязка идентификатора (когда `pinAnchor` ещё пуст).
 */
export async function setOwnProfilePin(
  rawPin: string,
  subjectIdCountry: SubjectIdCountry = SubjectIdCountry.KG,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Не авторизованы." };
  }

  let pinAnchor: string;
  try {
    pinAnchor = pinAnchorFromUserInput(rawPin, subjectIdCountry);
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
    return { ok: false, error: "Идентификатор уже сохранён. Используйте смену ниже." };
  }

  const taken = await prisma.profile.findFirst({
    where: { pinAnchor, NOT: { id: me.id } },
    select: { id: true },
  });
  if (taken) {
    return { ok: false, error: "Этот идентификатор уже привязан к другому аккаунту." };
  }

  const normalizedPin = normalizeSubjectIdDigits(rawPin);
  const dateOfBirth =
    subjectIdCountry === SubjectIdCountry.KG
      ? dateOfBirthFromKg14Pin(normalizedPin)
      : null;

  try {
    await prisma.profile.update({
      where: { id: me.id },
      data: {
        pinAnchor,
        subjectIdCountry,
        ...(dateOfBirth ? { dateOfBirth } : {}),
      },
    });
  } catch {
    return { ok: false, error: "Не удалось сохранить. Попробуйте ещё раз." };
  }

  revalidatePath("/");
  return { ok: true };
}

/**
 * Смена идентификатора у своего профиля (уже был сохранён якорь).
 */
export async function updateOwnSubjectId(
  rawPin: string,
  subjectIdCountry: SubjectIdCountry,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Не авторизованы." };
  }

  let pinAnchor: string;
  try {
    pinAnchor = pinAnchorFromUserInput(rawPin, subjectIdCountry);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Некорректный номер." };
  }

  const me = await prisma.profile.findFirst({
    where: { id: session.profileId, familyId: session.familyId },
    select: { id: true, pinAnchor: true },
  });
  if (!me) {
    return { ok: false, error: "Профиль не найден." };
  }
  if (!me.pinAnchor) {
    return { ok: false, error: "Сначала укажите идентификатор (первичная привязка)." };
  }

  const taken = await prisma.profile.findFirst({
    where: { pinAnchor, NOT: { id: me.id } },
    select: { id: true },
  });
  if (taken) {
    return { ok: false, error: "Этот идентификатор уже используется другим аккаунтом." };
  }

  const normalizedPin = normalizeSubjectIdDigits(rawPin);
  const dateOfBirth =
    subjectIdCountry === SubjectIdCountry.KG
      ? dateOfBirthFromKg14Pin(normalizedPin)
      : null;

  try {
    await prisma.profile.update({
      where: { id: me.id },
      data: {
        pinAnchor,
        subjectIdCountry,
        ...(dateOfBirth ? { dateOfBirth } : {}),
      },
    });
  } catch {
    return { ok: false, error: "Не удалось сохранить. Попробуйте ещё раз." };
  }

  revalidatePath("/");
  return { ok: true };
}
