import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { HealthRecordAnalysisPayload } from "@/types/biomarker";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const row = await prisma.shareToken.findUnique({ where: { token: params.token }, include: { healthRecord: true } });
  if (!row || row.expiresAt.getTime() < Date.now()) return NextResponse.json({ error: "Expired" }, { status: 404 });
  const data = row.healthRecord.data as HealthRecordAnalysisPayload;
  const id = data.sourceOriginalFileId ?? data.sourceFileId;
  const ext = data.mimeType === "application/pdf" ? "pdf" : data.mimeType.includes("png") ? "png" : data.mimeType.includes("webp") ? "webp" : "jpg";
  const full = path.join(process.cwd(), "uploads", "health-records", `${id}.${ext}`);
  const buf = await readFile(full);
  return new NextResponse(buf, { headers: { "Content-Type": data.mimeType } });
}
