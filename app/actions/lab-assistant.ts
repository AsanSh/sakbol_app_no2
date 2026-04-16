"use server";

import { searchLabReference } from "@/lib/lab-reference-search";

const DISCLAIMER =
  "Ниже — выдержки из справочника по лабораторным показателям (Хиггинс и др.). Это не диагноз и не замена врачу. Интерпретация индивидуальна.\n\n";

/**
 * Ответ «ИИ» на основе локального индекса книги (без вызова внешнего LLM).
 */
export async function askLabAssistantFromBook(question: string): Promise<{
  ok: true;
  answer: string;
  hasBook: boolean;
} | { ok: false; error: string }> {
  const q = question.trim();
  if (!q) {
    return { ok: false, error: "Введите вопрос." };
  }
  if (q.length > 2000) {
    return { ok: false, error: "Слишком длинный текст." };
  }

  const hits = searchLabReference(q, 4);
  if (hits.length === 0) {
    return {
      ok: true,
      hasBook: false,
      answer:
        "По этому запросу не нашлось близких фрагментов в загруженной части справочника. Уточните название показателя (например, «гемоглобин», «ЛПВП», «креатинин») или проверьте, что файл data/lab-reference-chunks.json собран (скрипт scripts/build-lab-reference.cjs).",
    };
  }

  const body = hits
    .map((h, i) => `— Фрагмент ${i + 1} —\n${h.text}`)
    .join("\n\n────────\n\n");

  return {
    ok: true,
    hasBook: true,
    answer: `${DISCLAIMER}${body}`,
  };
}
