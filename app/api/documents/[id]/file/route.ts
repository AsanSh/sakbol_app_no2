import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readHealthDocumentFromDisk } from "@/lib/health-documents-storage";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = ctx.params;
  const docId = id?.trim();
  if (!docId) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const doc = await prisma.healthDocument.findFirst({
    where: { id: docId, profile: { familyId: session.familyId } },
    select: { id: true, mimeType: true, title: true },
  });
  if (!doc || !doc.mimeType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = await readHealthDocumentFromDisk(doc.id, doc.mimeType);
  if (!buf) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const safeName = encodeURIComponent(
    doc.title.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s._-]+/g, "_").slice(0, 80) || "document",
  );

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
