import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { HealthRecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";
import { getSession } from "@/lib/session";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import { loadNotoSansCyrillicFonts } from "@/lib/pdf-fonts";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  try {
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
  pdf.registerFontkit(fontkit);
  const { regular: regBytes, bold: boldBytes } = await loadNotoSansCyrillicFonts();
  const font = await pdf.embedFont(regBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });

  let page = pdf.addPage([595, 842]); // A4 portrait
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
  } catch (e) {
    console.error("GET /api/analyses/[id]/pdf", e);
    const msg = e instanceof Error ? e.message : "PDF generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
