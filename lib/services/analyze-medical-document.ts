import "server-only";

import type { ContentBlock } from "@aws-sdk/client-bedrock-runtime";
import {
  bedrockAuthConfigured,
  bedrockConverse,
  bedrockLabOcrModelId,
  mimeToBedrockImageFormat,
} from "@/lib/bedrock-converse";
import {
  openRouterFallbackEnabled,
  openRouterPdfTextExtract,
  openRouterReasoningJson,
  openRouterReasoningModel,
  openRouterVisionExtract,
} from "@/lib/openrouter";
import { deepseekEnabled, deepseekReasoningJson } from "@/lib/deepseek";

/**
 * Расшифровка немедицинских (с т.з. лаборатории) документов: протоколов приёма
 * врача, выписок, направлений, рецептов, справок. Результат — структурированный
 * JSON, понятный пациенту.
 */
export type MedicalDocumentAnalysis = {
  documentKind: string;
  visitDate?: string;
  doctorSpecialty?: string;
  facility?: string;
  summary: string;
  complaints: string[];
  findings: string[];
  diagnoses: string[];
  prescriptions: Array<{ name: string; dose?: string; schedule?: string; reason?: string }>;
  recommendations: string[];
  followUpDoctors: Array<{ specialty: string; reason: string }>;
  redFlags: string[];
  questionsForDoctor: string[];
};

const DOCUMENT_ANALYSIS_SYSTEM_PROMPT = `Ты — образовательный медицинский ассистент SakBol. Тебе дают медицинский документ пациента (протокол приёма врача, выписка из стационара, направление, назначение/рецепт, справка или иной не-лабораторный документ) — в виде PDF, изображения или уже извлечённого текста.

Твоя задача — помочь пациенту понять документ простым языком.

ВЕРНИ ТОЛЬКО JSON, без markdown-обёртки и без текста вокруг. Схема:
{
  "documentKind": string,
  "visitDate": "YYYY-MM-DD" | "",
  "doctorSpecialty": string | "",
  "facility": string | "",
  "summary": string,
  "complaints": [string],
  "findings": [string],
  "diagnoses": [string],
  "prescriptions": [
    { "name": string, "dose": string, "schedule": string, "reason": string }
  ],
  "recommendations": [string],
  "followUpDoctors": [{ "specialty": string, "reason": string }],
  "redFlags": [string],
  "questionsForDoctor": [string]
}

Жёсткие правила:
- Пиши по-русски, кратко и по делу. Тон уважительный, без алармизма.
- Используй ТОЛЬКО то, что реально есть в документе. Ничего не придумывай.
- Если поле не указано в документе — оставь пустую строку или пустой массив.
- НИКОГДА не включай ФИО, ИНН/ПИН, номер паспорта, телефон, домашний адрес, фотографии лиц.
- Не ставь окончательный диагноз сам и не назначай новые лекарства/дозы. Перечисляй только то, что написал врач в документе.
- documentKind — короткое название по-русски: "Протокол приёма гастроэнтеролога", "Выписка из стационара", "Направление на УЗИ", "Назначение/рецепт", "Справка" и т.п.
- doctorSpecialty — специальность врача в нижнем регистре ("гастроэнтеролог", "терапевт", ...). Без ФИО.
- facility — короткое название клиники/больницы из документа, без адреса и телефонов.
- summary — 2–4 предложения общего смысла визита и назначений.
- prescriptions — препараты только из документа: name (МНН/торговое), dose (например "10 мг"), schedule ("1 раз в день, 14 дней"), reason (зачем — если указано). Поля, которых нет в документе, оставляй пустыми строками.
- followUpDoctors — к кому стоит сходить дополнительно по логике документа (если врач назначил консультации). Только специальность и причина.
- redFlags — пункты, которые требуют внимания пациента (срочный приём, контрольная проверка через N дней, "при ухудшении — скорая" и т.п.). Если ничего такого нет — пустой массив.
- questionsForDoctor — 3–6 коротких вопросов, которые пациенту полезно задать врачу по этому документу.
- Никаких пояснений, дисклеймеров или текста вокруг JSON. Никаких markdown-обёрток.`;

const DOCUMENT_USER_PROMPT =
  "Это медицинский документ пациента (не лабораторный анализ). Разбери его по схеме из системного промпта и верни только JSON.";

const DOCUMENT_DISCLAIMER =
  "Это автоматическая расшифровка документа на основе ИИ. Не диагноз и не назначение. Любые решения о лечении принимает только лечащий врач.";

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function asString(v: unknown, max = 240): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function asStringList(v: unknown, maxItems = 12, maxLen = 280): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => asString(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeOptionalIsoDate(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString().slice(0, 10);
}

function coerceAnalysis(raw: unknown): MedicalDocumentAnalysis {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const prescriptionsRaw = Array.isArray(o.prescriptions) ? o.prescriptions : [];
  const prescriptions = prescriptionsRaw
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        name: asString(r.name ?? r.drug ?? r.medication, 140),
        dose: asString(r.dose ?? r.dosage, 80) || undefined,
        schedule: asString(r.schedule ?? r.regimen ?? r.duration, 200) || undefined,
        reason: asString(r.reason ?? r.indication, 200) || undefined,
      };
    })
    .filter((r) => r.name)
    .slice(0, 30);

  const followUpRaw = Array.isArray(o.followUpDoctors) ? o.followUpDoctors : [];
  const followUpDoctors = followUpRaw
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        specialty: asString(r.specialty ?? r.doctor ?? r.kind, 80),
        reason: asString(r.reason ?? r.note, 280),
      };
    })
    .filter((r) => r.specialty)
    .slice(0, 12);

  return {
    documentKind: asString(o.documentKind ?? o.docKind ?? o.documentType, 140) || "Медицинский документ",
    visitDate: normalizeOptionalIsoDate(o.visitDate ?? o.date ?? o.documentDate),
    doctorSpecialty: asString(o.doctorSpecialty ?? o.specialty, 80) || undefined,
    facility: asString(o.facility ?? o.clinic, 200) || undefined,
    summary: asString(o.summary, 1200),
    complaints: asStringList(o.complaints),
    findings: asStringList(o.findings ?? o.examination ?? o.observations),
    diagnoses: asStringList(o.diagnoses ?? o.diagnosis),
    prescriptions,
    recommendations: asStringList(o.recommendations ?? o.advice),
    followUpDoctors,
    redFlags: asStringList(o.redFlags ?? o.alerts ?? o.warnings, 8),
    questionsForDoctor: asStringList(o.questionsForDoctor ?? o.questions, 8, 280),
  };
}

async function callBedrockOnDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  if (!bedrockAuthConfigured()) {
    return { ok: false, userMessage: "NO_KEY" };
  }
  const modelId = bedrockLabOcrModelId();
  let content: ContentBlock[];
  if (mimeType === "application/pdf") {
    content = [
      { text: DOCUMENT_USER_PROMPT },
      {
        document: {
          format: "pdf",
          name: "document",
          source: { bytes: new Uint8Array(buffer) },
        },
      },
    ];
  } else if (mimeType.startsWith("image/")) {
    content = [
      { text: DOCUMENT_USER_PROMPT },
      {
        image: {
          format: mimeToBedrockImageFormat(mimeType),
          source: { bytes: new Uint8Array(buffer) },
        },
      },
    ];
  } else {
    return {
      ok: false,
      userMessage: "Bedrock document analysis: поддерживаются только PDF или изображения.",
    };
  }
  return bedrockConverse({
    modelId,
    system: DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    maxTokens: 4096,
    temperature: 0.2,
  });
}

async function callOpenRouterOnDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  if (mimeType.startsWith("image/")) {
    return openRouterVisionExtract(
      DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
      DOCUMENT_USER_PROMPT,
      buffer,
      mimeType,
    );
  }
  if (mimeType === "application/pdf") {
    let pdfText = "";
    try {
      const mod = await import("pdf-parse");
      const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text?: string }> })
        .default;
      const data = await pdfParse(buffer);
      pdfText = String(data?.text ?? "").trim();
    } catch (e) {
      return {
        ok: false,
        userMessage: `OpenRouter fallback: не удалось извлечь текст из PDF (${(e as Error).message.slice(0, 160)}).`,
      };
    }
    return openRouterPdfTextExtract(
      DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
      DOCUMENT_USER_PROMPT,
      pdfText,
    );
  }
  return {
    ok: false,
    userMessage: "OpenRouter document analysis: поддерживаются только PDF или изображения.",
  };
}

async function callOpenRouterOnText(text: string): Promise<
  { ok: true; text: string } | { ok: false; userMessage: string }
> {
  const trimmed = text.replace(/\u0000/g, "").trim().slice(0, 60_000);
  if (!trimmed) {
    return { ok: false, userMessage: "Пустой текст документа." };
  }
  const enriched = `${DOCUMENT_USER_PROMPT}\n\n--- ТЕКСТ ДОКУМЕНТА ---\n${trimmed}`;
  return openRouterReasoningJson(DOCUMENT_ANALYSIS_SYSTEM_PROMPT, enriched);
}

/**
 * DeepSeek fallback (текст-only): PDF → pdf-parse → DeepSeek JSON.
 * Изображения не поддерживаются — DeepSeek работает только с текстом.
 */
async function callDeepSeekOnDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<{ ok: true; text: string } | { ok: false; userMessage: string }> {
  if (!deepseekEnabled()) {
    return { ok: false, userMessage: "NO_KEY" };
  }
  if (mimeType === "application/pdf") {
    let pdfText = "";
    try {
      const mod = await import("pdf-parse");
      const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text?: string }> })
        .default;
      const data = await pdfParse(buffer);
      pdfText = String(data?.text ?? "").replace(/\u0000/g, "").trim().slice(0, 60_000);
    } catch (e) {
      return {
        ok: false,
        userMessage: `DeepSeek fallback: не удалось извлечь текст из PDF (${(e as Error).message.slice(0, 160)}).`,
      };
    }
    if (!pdfText) {
      return { ok: false, userMessage: "DeepSeek fallback: PDF не содержит извлекаемого текста." };
    }
    const enriched = `${DOCUMENT_USER_PROMPT}\n\n--- ТЕКСТ PDF ---\n${pdfText}`;
    return deepseekReasoningJson(DOCUMENT_ANALYSIS_SYSTEM_PROMPT, enriched);
  }
  return {
    ok: false,
    userMessage: "DeepSeek: поддерживается только PDF (текстовый режим). Для изображений используйте Bedrock или OpenRouter.",
  };
}

export type AnalyzeMedicalDocumentResult =
  | {
      ok: true;
      analysis: MedicalDocumentAnalysis;
      modelId: string;
      disclaimer: string;
    }
  | { ok: false; error: string };

/**
 * Главная точка: PDF / изображение → структурированный JSON разбора.
 * Сначала пробуем Bedrock Nova Pro (multimodal). При ошибке — OpenRouter (Vision для картинок,
 * pdf-parse + текстовый prompt для PDF).
 */
export async function analyzeMedicalDocumentBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<AnalyzeMedicalDocumentResult> {
  if (buffer.length === 0) {
    return { ok: false, error: "Файл пуст." };
  }
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  if (!isImage && !isPdf) {
    return {
      ok: false,
      error: "Поддерживаются только PDF и изображения (PNG, JPG, WEBP). Для DOC/DOCX сохраните как PDF.",
    };
  }

  let usedModelId = bedrockLabOcrModelId();
  let res = await callBedrockOnDocument(buffer, mimeType);

  if (!res.ok && openRouterFallbackEnabled()) {
    console.warn(
      "[analyzeMedicalDocument] Bedrock failed, falling back to OpenRouter:",
      res.userMessage,
    );
    res = await callOpenRouterOnDocument(buffer, mimeType);
    usedModelId = openRouterReasoningModel();
  }

  if (!res.ok && deepseekEnabled()) {
    console.warn(
      "[analyzeMedicalDocument] OpenRouter failed, falling back to DeepSeek:",
      res.userMessage,
    );
    res = await callDeepSeekOnDocument(buffer, mimeType);
    usedModelId = "deepseek-chat";
  }

  if (!res.ok) {
    return {
      ok: false,
      error:
        res.userMessage === "NO_KEY"
          ? "ИИ-провайдер не настроен. Задайте Bedrock (AWS), OPENROUTER_API_KEY или DEEPSEEK_API_KEY."
          : `Не удалось получить разбор документа: ${res.userMessage}`,
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

  const analysis = coerceAnalysis(parsed);

  if (!analysis.summary && analysis.diagnoses.length === 0 && analysis.prescriptions.length === 0) {
    return {
      ok: false,
      error: "Пустой разбор от модели. Попробуйте ещё раз или проверьте качество скана.",
    };
  }

  return {
    ok: true,
    analysis,
    modelId: usedModelId,
    disclaimer: DOCUMENT_DISCLAIMER,
  };
}

/**
 * Резерв: уже извлечённый текст (например, из готовой OCR-выгрузки) — отдаём в
 * рассуждающую модель напрямую без бинарника. Используется как «текстовый» fallback,
 * если оба провайдера не справились с бинарём.
 */
export async function analyzeMedicalDocumentFromText(
  text: string,
): Promise<AnalyzeMedicalDocumentResult> {
  const res = await callOpenRouterOnText(text);
  if (!res.ok) {
    return { ok: false, error: `Не удалось получить разбор документа: ${res.userMessage}` };
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
  const analysis = coerceAnalysis(parsed);
  if (!analysis.summary && analysis.diagnoses.length === 0 && analysis.prescriptions.length === 0) {
    return { ok: false, error: "Пустой разбор от модели. Попробуйте ещё раз позже." };
  }
  return {
    ok: true,
    analysis,
    modelId: openRouterReasoningModel(),
    disclaimer: DOCUMENT_DISCLAIMER,
  };
}

export const DOCUMENT_ANALYSIS_DISCLAIMER = DOCUMENT_DISCLAIMER;
