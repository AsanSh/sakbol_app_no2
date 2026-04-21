import { NextResponse } from "next/server";
import { createHealthDocumentForProfile } from "@/lib/health-document-create";
import { parseHealthDocumentCategory } from "@/lib/health-documents-storage";
import { findProfileForAutomation } from "@/lib/profile-resolve-automation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function checkAutomationAuth(req: Request): NextResponse | null {
  const expected = process.env.DOCUMENTS_AUTOMATION_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !expected) {
    return NextResponse.json(
      { error: "DOCUMENTS_AUTOMATION_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (!expected) {
    console.warn("documents/upload-automated: DOCUMENTS_AUTOMATION_SECRET empty (dev only)");
    return null;
  }
  const auth = req.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const headerSecret = req.headers.get("x-documents-secret")?.trim();
  const token = bearer || headerSecret;
  if (token !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Массовая загрузка PDF/документов из внешнего скрипта.
 * multipart: file, category, adeskId? , fullName? (ФИО), title? , documentDate? (ISO)
 */
export async function POST(req: Request) {
  const denied = checkAutomationAuth(req);
  if (denied) return denied;

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

  const adeskId = String(form.get("adeskId") ?? "").trim() || null;
  const fullName = String(form.get("fullName") ?? "").trim() || null;
  const category = parseHealthDocumentCategory(String(form.get("category") ?? "OTHER"));
  const titleRaw = String(form.get("title") ?? "").trim();
  const dateRaw = String(form.get("documentDate") ?? "").trim();

  if (!adeskId && !fullName) {
    return NextResponse.json({ error: "Provide adeskId or fullName" }, { status: 400 });
  }

  const profile = await findProfileForAutomation({ adeskId, fullName });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const title =
    titleRaw ||
    (file.name && file.name !== "blob" ? file.name : `Документ ${new Date().toLocaleDateString("ru-RU")}`);

  let documentDate: Date | null = null;
  if (dateRaw) {
    const d = new Date(dateRaw);
    if (!Number.isNaN(d.getTime())) documentDate = d;
  }

  const created = await createHealthDocumentForProfile({
    profileId: profile.id,
    title,
    category,
    documentDate,
    buffer: buf,
    mime,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    id: created.id,
    fileUrl: created.fileUrl,
    profileId: profile.id,
  });
}
