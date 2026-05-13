import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkProfileAccess } from "@/lib/profile-access-control";
import { loadHealthDocumentFileBuffer } from "@/lib/health-document-buffer";
import {
  extractPlainTextFromHealthDocumentBuffer,
  isHealthDocumentTextExtractable,
} from "@/lib/health-document-text-extract";
import { getSession } from "@/lib/session";
import {
  translateHealthDocumentPlainText,
  type DocTranslateTargetLang,
} from "@/lib/translate-health-document-text";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_LANG = new Set<DocTranslateTargetLang>(["ru", "en", "hi"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const docId = id?.trim();
    if (!docId) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    let body: { targetLang?: string };
    try {
      body = (await req.json()) as { targetLang?: string };
    } catch {
      return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
    }

    const raw = String(body.targetLang ?? "").trim().toLowerCase();
    const targetLang = raw as DocTranslateTargetLang;
    if (!ALLOWED_LANG.has(targetLang)) {
      return NextResponse.json({ error: "Invalid targetLang (use ru, en, hi)" }, { status: 400 });
    }
    const lang = targetLang as DocTranslateTargetLang;

    const doc = await prisma.healthDocument.findFirst({
      where: { id: docId },
      select: {
        id: true,
        profileId: true,
        title: true,
        mimeType: true,
        fileUrl: true,
        fileData: true,
      },
    });

    if (!doc || !doc.mimeType) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const access = await checkProfileAccess(session, doc.profileId);
    if (!access.ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isHealthDocumentTextExtractable(doc.mimeType)) {
      return NextResponse.json(
        {
          error:
            "Перевод доступен только для PDF и изображений. Сохраните документ как PDF и загрузите снова.",
        },
        { status: 400 },
      );
    }

    const buffer = await loadHealthDocumentFileBuffer({
      id: doc.id,
      mimeType: doc.mimeType,
      fileUrl: doc.fileUrl,
      fileData: doc.fileData,
    });

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: "Файл недоступен." }, { status: 404 });
    }

    const plain = await extractPlainTextFromHealthDocumentBuffer(buffer, doc.mimeType);
    const translated = await translateHealthDocumentPlainText(plain, lang);
    if (!translated.ok) {
      return NextResponse.json({ error: translated.error }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      title: doc.title,
      mimeType: doc.mimeType,
      targetLang: lang,
      text: translated.text,
    });
  } catch (e) {
    console.error("POST /api/documents/[id]/translate", e);
    const msg = e instanceof Error ? e.message : "translate_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
