"use server";

import { HealthRecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";
import { getSession } from "@/lib/session";
import type { ParsedBiomarker } from "@/types/biomarker";

const DISCLAIMER =
  "Информация справочная, не диагноз и не замена консультации врача. Статусы у показателей на вкладке «Анализы» считаются по референсу с вашего бланка (если он распознан) и по возрасту.\n\n";

const MAX_BIOMARKERS_IN_CONTEXT = 45;

function formatBiomarkersForSearch(biomarkers: ParsedBiomarker[]): string {
  if (!biomarkers?.length) return "";
  return biomarkers
    .slice(0, MAX_BIOMARKERS_IN_CONTEXT)
    .map((b) => `${b.biomarker}: ${b.value} ${b.unit} (реф. ${b.reference})`)
    .join("\n");
}

async function latestLabContextBlock(
  familyId: string,
  profileId: string,
): Promise<string | null> {
  const member = await prisma.profile.findFirst({
    where: { id: profileId, familyId },
    select: { id: true },
  });
  if (!member) return null;

  const row = await prisma.healthRecord.findFirst({
    where: { profileId, kind: HealthRecordKind.LAB_ANALYSIS },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      data: true,
      metrics: { select: { payload: true } },
    },
  });
  if (!row) return null;

  const payload = resolveLabAnalysisPayload(row.data, row.metrics?.payload ?? null);
  const lines = formatBiomarkersForSearch(payload.biomarkers);
  if (!lines) return null;

  const date = row.createdAt.toISOString().slice(0, 10);
  return `Дата анализа: ${date}\n${lines}`;
}

/**
 * Ответ без внешней «книги»: только контекст последнего анализа и общий дисклеймер.
 */
export async function askLabAssistantFromBook(
  question: string,
  activeProfileId?: string | null,
): Promise<{
  ok: true;
  answer: string;
  hasBook: boolean;
  usedLastLab: boolean;
} | { ok: false; error: string }> {
  const q = question.trim();
  if (!q) {
    return { ok: false, error: "Введите вопрос." };
  }
  if (q.length > 2000) {
    return { ok: false, error: "Слишком длинный текст." };
  }

  const session = getSession();
  const pid = activeProfileId?.trim() || null;

  if (session && pid) {
    const block = await latestLabContextBlock(session.familyId, pid);
    if (block) {
      return {
        ok: true,
        hasBook: false,
        usedLastLab: true,
        answer: `${DISCLAIMER}Контекст последнего анализа выбранного профиля:\n\n${block}\n\n—\nВаш вопрос: «${q}»\n\nОбщие медицинские тексты в приложении отключены. Сверяйтесь с подписями и референсами на бланке и при необходимости обсудите результаты с лечащим врачом.`,
      };
    }
  }

  return {
    ok: true,
    hasBook: false,
    usedLastLab: false,
    answer: `${DISCLAIMER}Загрузите анализ для выбранного профиля — тогда в ответ можно будет подставить его показатели. Общий справочник по литературе отключён.\n\nВаш вопрос: «${q}»`,
  };
}
