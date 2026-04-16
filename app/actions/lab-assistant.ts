"use server";

import { HealthRecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";
import { getSession } from "@/lib/session";
import { searchLabReference } from "@/lib/lab-reference-search";
import type { ParsedBiomarker } from "@/types/biomarker";

const DISCLAIMER =
  "Ниже — выдержки из справочника по лабораторным показателям (Хиггинс и др.). Это не диагноз и не замена врачу. Интерпретация индивидуальна.\n\n";

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
 * Ответ «ИИ» на основе локального индекса книги (без вызова внешнего LLM).
 * @param activeProfileId — профиль из переключателя семьи; подмешивается последний лаб. анализ для поиска по книге.
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

  let usedLastLab = false;
  let searchQuery = q;

  const session = getSession();
  const pid = activeProfileId?.trim() || null;
  if (session && pid) {
    const block = await latestLabContextBlock(session.familyId, pid);
    if (block) {
      usedLastLab = true;
      searchQuery = `${q}\n\n---\nКонтекст последнего анализа выбранного профиля:\n${block}`;
    }
  }

  const hits = searchLabReference(searchQuery, 4);
  if (hits.length === 0) {
    return {
      ok: true,
      hasBook: false,
      usedLastLab,
      answer:
        "По этому запросу не нашлось близких фрагментов в загруженной части справочника. Уточните название показателя (например, «гемоглобин», «ЛПВП», «креатинин») или проверьте, что файл data/lab-reference-chunks.json собран (скрипт scripts/build-lab-reference.cjs).",
    };
  }

  const body = hits
    .map((h, i) => `— Фрагмент ${i + 1} —\n${h.text}`)
    .join("\n\n────────\n\n");

  const labNote = usedLastLab
    ? "К поиску добавлены показатели из последнего загруженного анализа выбранного профиля.\n\n"
    : "";

  return {
    ok: true,
    hasBook: true,
    usedLastLab,
    answer: `${DISCLAIMER}${labNote}${body}`,
  };
}
