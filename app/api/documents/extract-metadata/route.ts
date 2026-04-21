import { NextResponse } from "next/server";
import { extractMetadataFromPlainText, findMentionedFamilyProfile } from "@/lib/health-document-metadata";
import { extractPlainTextFromHealthDocumentBuffer } from "@/lib/health-document-text-extract";
import { normalizeUploadedFilename } from "@/lib/filename-encoding";
import { HEALTH_DOCS_MAX_BYTES, HEALTH_DOC_ALLOWED_MIME } from "@/lib/health-documents-storage";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Превью метаданных без сохранения: PDF (pdf-parse) и изображения (Tesseract rus+eng).
 */
export async function POST(req: Request) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";

  if (!HEALTH_DOC_ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "Неподдерживаемый тип файла." }, { status: 400 });
  }
  if (buf.length === 0 || buf.length > HEALTH_DOCS_MAX_BYTES) {
    return NextResponse.json({ error: "Некорректный размер файла." }, { status: 400 });
  }

  const rawName = file.name && file.name !== "blob" ? normalizeUploadedFilename(file.name) : "";

  const plain = await extractPlainTextFromHealthDocumentBuffer(buf, mime);
  const meta = extractMetadataFromPlainText(plain, { fileBaseName: rawName });

  const profiles = await prisma.profile.findMany({
    where: { familyId: session.familyId },
    select: { id: true, displayName: true },
  });
  const mentionedProfile =
    plain.length > 0 ? findMentionedFamilyProfile(plain, profiles) : null;

  return NextResponse.json({
    ok: true,
    title: meta.title,
    category: meta.category,
    documentDate: meta.documentDateISO,
    textExtractedLength: plain.length,
    mentionedProfile,
  });
}
