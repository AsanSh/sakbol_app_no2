import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";
import { labUploadDiskPath } from "@/lib/sakbol-lab-upload-path";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const row = await prisma.shareToken.findUnique({
    where: { token: params.token },
    include: { healthRecord: { include: { metrics: { select: { payload: true } } } } },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Expired" }, { status: 404 });
  }
  const data = resolveLabAnalysisPayload(
    row.healthRecord.data,
    row.healthRecord.metrics?.payload ?? null,
  );

  if (data.sourceBlobUrl?.startsWith("https://")) {
    return NextResponse.redirect(data.sourceBlobUrl, 302);
  }

  const id = data.sourceOriginalFileId ?? data.sourceFileId;
  if (!id || id === "legacy") {
    return NextResponse.json({ error: "No file for this record" }, { status: 404 });
  }

  try {
    const full = labUploadDiskPath(id, data.mimeType);
    const buf = await readFile(full);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": data.mimeType,
        "Cache-Control": "private, max-age=120",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Файл недоступен на этом сервере (часто на Vercel без BLOB_READ_WRITE_TOKEN при загрузке). Добавьте токен Blob в env и загрузите анализ заново.",
      },
      { status: 404 },
    );
  }
}
