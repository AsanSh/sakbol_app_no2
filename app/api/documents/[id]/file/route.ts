import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkProfileAccess } from "@/lib/profile-access-control";
import { readHealthDocumentFromDisk } from "@/lib/health-documents-storage";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const asDownload = new URL(req.url).searchParams.get("download") === "1";

  const { id } = await ctx.params;
  const docId = id?.trim();
  if (!docId) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const doc = await prisma.healthDocument.findFirst({
    where: { id: docId },
    select: { id: true, profileId: true, mimeType: true, title: true, fileUrl: true, fileData: true },
  });
  if (!doc || !doc.mimeType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await checkProfileAccess(session, doc.profileId);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (doc.fileUrl.startsWith("http://") || doc.fileUrl.startsWith("https://")) {
    return NextResponse.redirect(doc.fileUrl, 302);
  }

  const disp = (safeName: string) =>
    asDownload
      ? `attachment; filename*=UTF-8''${safeName}`
      : `inline; filename*=UTF-8''${safeName}`;

  if (doc.fileData && doc.fileData.byteLength > 0) {
    const safeName = encodeURIComponent(
      doc.title.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s._-]+/g, "_").slice(0, 80) || "document",
    );
    return new NextResponse(new Uint8Array(doc.fileData), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": disp(safeName),
        "Cache-Control": "private, max-age=3600",
      },
    });
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
      "Content-Disposition": disp(safeName),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
