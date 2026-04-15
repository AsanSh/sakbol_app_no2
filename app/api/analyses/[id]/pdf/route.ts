import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { HealthRecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";
import { getSession } from "@/lib/session";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recordId = ctx.params.id;
  const record = await prisma.healthRecord.findFirst({
    where: {
      id: recordId,
      kind: HealthRecordKind.LAB_ANALYSIS,
      profile: { familyId: session.familyId },
    },
    select: {
      id: true,
      createdAt: true,
      data: true,
      metrics: { select: { payload: true } },
      profile: { select: { id: true } },
    },
  });

  if (!record) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  const payload = resolveLabAnalysisPayload(record.data, record.metrics?.payload ?? null);
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]); // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  let y = 800;
  const draw = (text: string, size = 11, isBold = false) => {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.1, 0.12, 0.14),
      maxWidth: 510,
      lineHeight: size + 3,
    });
    y -= size + 6;
  };

  draw("Sakbol - Anonymized Lab Analysis", 15, true);
  draw(`Pseudo ID: ${formatClinicalAnonymId(record.profile.id)}`, 11, true);
  draw(`Created: ${record.createdAt.toISOString().slice(0, 10)}`);
  draw("Contains no full name, phone, or passport/INN fields.");
  y -= 4;
  draw("Biomarkers", 12, true);

  if (!payload.biomarkers.length) {
    draw("- No biomarkers found");
  } else {
    for (const bm of payload.biomarkers) {
      const row = `- ${bm.biomarker}: ${bm.value} ${bm.unit} (ref: ${bm.reference})`;
      draw(row);
    }
  }

  const bytes = await pdf.save();
  const filename = `sakbol-analysis-${record.id}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
