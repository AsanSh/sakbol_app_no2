import "server-only";

import { checkProfileAccess } from "@/lib/profile-access-control";
import { getSession } from "@/lib/session";
import { processMedicalDocument } from "@/lib/services/process-medical-document";
import type { ParsedBiomarker } from "@/types/biomarker";

const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export type PreviewLabOcrResult =
  | {
      ok: true;
      draft: {
        biomarkers: ParsedBiomarker[];
        analysisDate?: string;
        labName?: string;
        ocrParser: "gemini" | "openai" | "bedrock" | "mock";
      };
    }
  | { ok: false; error: string };

/**
 * Распознавание бланка без сохранения (Smart Upload).
 * Обычный серверный модуль без «use server» — безопасно вызывать из Route Handler.
 */
export async function executePreviewLabOcr(formData: FormData): Promise<PreviewLabOcrResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const profileId = String(formData.get("profileId") ?? "").trim();
  const file = formData.get("file");

  if (!profileId || !(file instanceof File)) {
    return { ok: false as const, error: "Маалымат толук эмес." };
  }

  const access = await checkProfileAccess(session, profileId);
  if (!access.ok) {
    return { ok: false as const, error: "Профиль табылган жок." };
  }
  if (!access.canWrite) {
    return { ok: false as const, error: "Нет прав добавлять анализы в этот профиль." };
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return { ok: false as const, error: "Файл форматы колдоого алынбайт." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { ok: false as const, error: "Файл өлчөмү чектен ашып кетти." };
  }

  try {
    const parsed = await processMedicalDocument(buf, mime);
    return {
      ok: true as const,
      draft: {
        biomarkers: parsed.biomarkers,
        analysisDate: parsed.analysisDate,
        labName: parsed.labName,
        ocrParser: parsed.parser,
      },
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Не удалось разобрать документ.",
    };
  }
}
