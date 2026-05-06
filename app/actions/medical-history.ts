"use server";

import { HealthRecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkProfileAccess } from "@/lib/profile-access-control";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";
import { getSession } from "@/lib/session";
import {
  bedrockConverse,
  bedrockLabOcrModelId,
} from "@/lib/bedrock-converse";
import {
  openRouterFallbackEnabled,
  openRouterReasoningJson,
  openRouterReasoningModel,
} from "@/lib/openrouter";

const DISCLAIMER =
  "Это автоматическая интерпретация на основе ваших загруженных данных. Не диагноз и не назначение, статусы зависят от референсов с бланков и возраста. Любые решения о лечении принимает только лечащий врач.";

const MAX_ANALYSES = 8;
const MAX_DOCUMENTS = 12;
const MAX_MEDICATIONS = 30;
const MAX_BIOMARKERS_PER_RECORD = 30;

const ANALYSIS_SYSTEM_PROMPT = `Ты — образовательный медицинский ассистент приложения SakBol. Аудитория — русскоязычные пользователи (Кыргызстан и регион).
Анализируй ТОЛЬКО предоставленные данные пользователя: список последних анализов с показателями и референсами, список загруженных медицинских документов (только метаданные: тип, заголовок, дата) и список текущих лекарств. Никаких внешних данных и никаких персональных данных не выдумывай.

Твоя задача — выдать структурированный JSON БЕЗ markdown-обёртки и БЕЗ пояснений вокруг. Структура:
{
  "summary": string,
  "dynamics": [{ "biomarker": string, "trend": "rising"|"falling"|"stable"|"insufficient_data", "comment": string }],
  "riskFlags": [{ "title": string, "severity": "info"|"watch"|"important", "explanation": string }],
  "doctorRecommendations": [{ "specialty": string, "reason": string }],
  "questionsForDoctor": [string]
}

Правила:
- Не ставь диагноз, не назначай лекарства/дозы/схемы.
- Не выдумывай показатели, которых нет во входных данных.
- Если данных мало (1 анализ, мало документов) — уменьши уверенность и пиши "insufficient_data" в trend.
- summary: 2–4 предложения по-русски, общая картина.
- riskFlags: только то, что прямо следует из показателей с явным отклонением от референса или из явных метаданных документа (например, "выписка после операции" + лабораторные сдвиги).
- doctorRecommendations.specialty: одна из ["терапевт","гастроэнтеролог","эндокринолог","кардиолог","невролог","нефролог","гинеколог","уролог","дерматолог","гематолог","инфекционист","ревматолог","пульмонолог","офтальмолог","онколог","психотерапевт","другое"] (или другой уместный).
- questionsForDoctor: 3–6 коротких вопросов, которые пациенту полезно задать врачу.
- Тон: уважительный, без алармизма.
- Никогда не упоминай ФИО, ИНН/ПИН, телефоны, адреса.`;

type AnalyzeMedicalHistoryResult =
  | {
      ok: true;
      result: MedicalHistoryAnalysis;
      meta: {
        analysesUsed: number;
        documentsUsed: number;
        medicationsUsed: number;
        modelId: string;
      };
      disclaimer: string;
    }
  | { ok: false; error: string };

export type MedicalHistoryAnalysis = {
  summary: string;
  dynamics: Array<{
    biomarker: string;
    trend: "rising" | "falling" | "stable" | "insufficient_data";
    comment: string;
  }>;
  riskFlags: Array<{
    title: string;
    severity: "info" | "watch" | "important";
    explanation: string;
  }>;
  doctorRecommendations: Array<{ specialty: string; reason: string }>;
  questionsForDoctor: string[];
};

function safeAge(dateOfBirth: Date | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const ms = Date.now() - dateOfBirth.getTime();
  if (ms <= 0) return null;
  const years = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
  if (years <= 0 || years > 130) return null;
  return years;
}

function sexLabel(sex: string | null | undefined): string {
  if (sex === "MALE") return "мужской";
  if (sex === "FEMALE") return "женский";
  return "не указан";
}

function categoryLabel(c: string): string {
  switch (c) {
    case "ANALYSIS":
      return "анализ";
    case "DISCHARGE_SUMMARY":
      return "выписка";
    case "PROTOCOL":
      return "протокол осмотра";
    case "PRESCRIPTION":
      return "назначение/рецепт";
    case "CONTRACT":
      return "договор";
    default:
      return "документ";
  }
}

function isoDay(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function coerceAnalysis(raw: unknown): MedicalHistoryAnalysis {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary.trim() : "";

  const dynamics = Array.isArray(o.dynamics)
    ? o.dynamics
        .map((row) => {
          const r = row as Record<string, unknown>;
          const trendRaw = String(r.trend ?? "").toLowerCase();
          const trend: MedicalHistoryAnalysis["dynamics"][number]["trend"] =
            trendRaw === "rising" || trendRaw === "falling" || trendRaw === "stable"
              ? (trendRaw as "rising" | "falling" | "stable")
              : "insufficient_data";
          return {
            biomarker: String(r.biomarker ?? "").trim().slice(0, 120),
            trend,
            comment: String(r.comment ?? "").trim().slice(0, 600),
          };
        })
        .filter((r) => r.biomarker)
    : [];

  const riskFlags = Array.isArray(o.riskFlags)
    ? o.riskFlags
        .map((row) => {
          const r = row as Record<string, unknown>;
          const sev = String(r.severity ?? "info").toLowerCase();
          const severity: MedicalHistoryAnalysis["riskFlags"][number]["severity"] =
            sev === "watch" || sev === "important" ? (sev as "watch" | "important") : "info";
          return {
            title: String(r.title ?? "").trim().slice(0, 200),
            severity,
            explanation: String(r.explanation ?? "").trim().slice(0, 800),
          };
        })
        .filter((r) => r.title)
    : [];

  const doctorRecommendations = Array.isArray(o.doctorRecommendations)
    ? o.doctorRecommendations
        .map((row) => {
          const r = row as Record<string, unknown>;
          return {
            specialty: String(r.specialty ?? "").trim().slice(0, 80),
            reason: String(r.reason ?? "").trim().slice(0, 400),
          };
        })
        .filter((r) => r.specialty)
    : [];

  const questionsForDoctor = Array.isArray(o.questionsForDoctor)
    ? o.questionsForDoctor
        .map((q) => String(q ?? "").trim().slice(0, 280))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return { summary, dynamics, riskFlags, doctorRecommendations, questionsForDoctor };
}

/**
 * Глубокий анализ истории профиля: последние анализы (биомаркеры из metrics),
 * метаданные документов и список лекарств — единый промпт в Amazon Bedrock Nova Pro.
 * Возвращает структурированный JSON с обзором, динамикой, risk-флагами,
 * рекомендованными специалистами и списком вопросов для врача.
 */
export async function analyzeMedicalHistoryForProfile(
  profileId: string,
): Promise<AnalyzeMedicalHistoryResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Unauthorized." };
  }

  const id = profileId?.trim();
  if (!id) {
    return { ok: false, error: "Profile id missing." };
  }

  const access = await checkProfileAccess(session, id);
  if (!access.ok) {
    return { ok: false, error: "Профиль не найден или нет доступа." };
  }

  const profile = await prisma.profile.findUnique({
    where: { id },
    select: {
      dateOfBirth: true,
      biologicalSex: true,
      managedRole: true,
    },
  });
  if (!profile) {
    return { ok: false, error: "Профиль не найден." };
  }

  const [analyses, documents, medications] = await Promise.all([
    prisma.healthRecord.findMany({
      where: { profileId: id, kind: HealthRecordKind.LAB_ANALYSIS },
      orderBy: { createdAt: "desc" },
      take: MAX_ANALYSES,
      select: {
        createdAt: true,
        data: true,
        metrics: { select: { payload: true } },
      },
    }),
    prisma.healthDocument.findMany({
      where: { profileId: id },
      orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
      take: MAX_DOCUMENTS,
      select: {
        title: true,
        category: true,
        documentDate: true,
        createdAt: true,
      },
    }),
    prisma.medication.findMany({
      where: { profileId: id },
      orderBy: { createdAt: "desc" },
      take: MAX_MEDICATIONS,
      select: { name: true, dosage: true, timeOfDay: true },
    }),
  ]);

  if (analyses.length === 0 && documents.length === 0 && medications.length === 0) {
    return {
      ok: false,
      error:
        "Для глубокого анализа загрузите хотя бы один анализ или документ (выписку, протокол) для выбранного профиля.",
    };
  }

  const age = safeAge(profile.dateOfBirth);
  const profileLine = `Возраст: ${age ?? "не указан"}; пол: ${sexLabel(profile.biologicalSex)}.`;

  const analysesBlock = analyses
    .map((row, idx) => {
      const payload = resolveLabAnalysisPayload(row.data, row.metrics?.payload ?? null);
      const date = payload.analysisDate || isoDay(row.createdAt);
      const lines = payload.biomarkers
        .slice(0, MAX_BIOMARKERS_PER_RECORD)
        .map((b) => `- ${b.biomarker}: ${b.value} ${b.unit} (реф. ${b.reference || "—"})`);
      return `Анализ #${idx + 1}, дата ${date}:\n${lines.join("\n") || "(показателей нет)"}`;
    })
    .join("\n\n");

  const documentsBlock = documents
    .map((d, idx) => {
      const date = isoDay(d.documentDate ?? d.createdAt);
      const cat = categoryLabel(d.category);
      const title = (d.title || "").trim().slice(0, 160);
      return `Документ #${idx + 1}: ${cat}; дата ${date}; заголовок: ${title || "(без заголовка)"}`;
    })
    .join("\n");

  const medicationsBlock = medications
    .map((m, idx) => {
      const dosage = (m.dosage || "").trim();
      const tod = (m.timeOfDay || "").trim();
      return `Лекарство #${idx + 1}: ${m.name}${dosage ? ", " + dosage : ""}${tod ? ", " + tod : ""}`;
    })
    .join("\n");

  const userText = [
    profileLine,
    "",
    analyses.length > 0 ? "Последние анализы (от свежих к старым):" : "Анализов нет.",
    analysesBlock || "",
    "",
    documents.length > 0 ? "Загруженные документы (метаданные, без содержимого):" : "Документов нет.",
    documentsBlock || "",
    "",
    medications.length > 0 ? "Принимаемые лекарства:" : "Лекарств в карточке нет.",
    medicationsBlock || "",
    "",
    "Верни ТОЛЬКО JSON по схеме из системного промпта (без префиксов, без ```).",
  ].join("\n");

  const bedrockModelId = bedrockLabOcrModelId();
  let usedModelId = bedrockModelId;

  let res = await bedrockConverse({
    modelId: bedrockModelId,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: [{ text: userText }] }],
    maxTokens: 2048,
    temperature: 0.2,
  });

  if (!res.ok && openRouterFallbackEnabled()) {
    console.warn(
      "[medical-history] Bedrock failed, falling back to OpenRouter:",
      res.userMessage,
    );
    const fb = await openRouterReasoningJson(ANALYSIS_SYSTEM_PROMPT, userText);
    if (fb.ok) {
      res = fb;
      usedModelId = openRouterReasoningModel();
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      error:
        res.userMessage === "NO_KEY"
          ? "Bedrock не настроен на сервере. Задайте AWS-доступы и ANTHROPIC_PROVIDER=bedrock."
          : `Не удалось получить разбор: ${res.userMessage}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(res.text));
  } catch (e) {
    return {
      ok: false,
      error: `Модель вернула не-JSON ответ. ${(e as Error).message.slice(0, 200)}`,
    };
  }

  const result = coerceAnalysis(parsed);

  if (!result.summary && result.dynamics.length === 0 && result.riskFlags.length === 0) {
    return {
      ok: false,
      error: "Пустой разбор от модели. Попробуйте ещё раз позже.",
    };
  }

  return {
    ok: true,
    result,
    meta: {
      analysesUsed: analyses.length,
      documentsUsed: documents.length,
      medicationsUsed: medications.length,
      modelId: usedModelId,
    },
    disclaimer: DISCLAIMER,
  };
}
