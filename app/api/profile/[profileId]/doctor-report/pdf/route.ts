import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { BiologicalSex, HealthDocumentCategory, HealthRecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkProfileAccess } from "@/lib/profile-access-control";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";
import { getSession } from "@/lib/session";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import { loadNotoSansCyrillicFonts } from "@/lib/pdf-fonts";
import { ageYearsFromIsoDob } from "@/lib/risk-scores";

export const dynamic = "force-dynamic";

const DOC_CAT_RU: Record<HealthDocumentCategory, string> = {
  ANALYSIS: "Анализы / заключения",
  DISCHARGE_SUMMARY: "Выписки",
  PROTOCOL: "Протоколы",
  PRESCRIPTION: "Рецепты / назначения",
  CONTRACT: "Договоры",
  OTHER: "Прочее",
};

function sexRu(s: BiologicalSex): string {
  if (s === BiologicalSex.MALE) return "мужской";
  if (s === BiologicalSex.FEMALE) return "женский";
  return "не указан";
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ profileId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profileId } = await ctx.params;
    const pid = profileId.trim();
    if (!pid) {
      return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
    }

    const access = await checkProfileAccess(session, pid);
    if (!access.ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await prisma.profile.findFirst({
      where: { id: pid },
      select: {
        id: true,
        dateOfBirth: true,
        biologicalSex: true,
        heightCm: true,
        weightKg: true,
        bloodType: true,
        medCardIsDoctor: true,
        medCardDoctorNote: true,
        medCardIsCaregiver: true,
        medCardCaregiverNote: true,
        medications: {
          orderBy: { name: "asc" },
          select: { name: true, dosage: true, timeOfDay: true },
        },
        healthRecords: {
          where: { kind: HealthRecordKind.LAB_ANALYSIS },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            title: true,
            createdAt: true,
            data: true,
            metrics: { select: { payload: true } },
          },
        },
        healthDocuments: {
          select: { category: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const anonymId = formatClinicalAnonymId(profile.id);
    const age =
      profile.dateOfBirth != null
        ? ageYearsFromIsoDob(profile.dateOfBirth.toISOString().slice(0, 10))
        : null;
    let bmiStr = "—";
    if (
      typeof profile.heightCm === "number" &&
      profile.heightCm > 0 &&
      typeof profile.weightKg === "number" &&
      profile.weightKg > 0
    ) {
      const m = profile.heightCm / 100;
      bmiStr = (profile.weightKg / (m * m)).toFixed(1);
    }

    const docCounts = new Map<HealthDocumentCategory, number>();
    for (const c of Object.keys(DOC_CAT_RU) as HealthDocumentCategory[]) {
      docCounts.set(c, 0);
    }
    for (const d of profile.healthDocuments) {
      docCounts.set(d.category, (docCounts.get(d.category) ?? 0) + 1);
    }

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const { regular: regBytes, bold: boldBytes } = await loadNotoSansCyrillicFonts();
    const font = await pdf.embedFont(regBytes, { subset: true });
    const bold = await pdf.embedFont(boldBytes, { subset: true });

    let page = pdf.addPage([595, 842]);
    const margin = 40;
    let y = 800;
    const draw = (text: string, size = 11, isBold = false) => {
      if (y < 56) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      page.drawText(text, {
        x: margin,
        y,
        size,
        font: isBold ? bold : font,
        color: rgb(0.1, 0.12, 0.14),
        maxWidth: 515,
        lineHeight: size + 3,
      });
      y -= size + 5;
    };

    const today = new Date().toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    draw("Медицинский отчёт для врача (без ФИО и контактов)", 14, true);
    draw(`Сформировано в SakBol · ${today}`, 10);
    y -= 6;
    draw(`Клинический псевдоним: ${anonymId}`, 11, true);
    draw("Документ предназначен для очной консультации. Данные носят справочный характер.", 9);
    y -= 8;

    draw("1. Общие сведения", 12, true);
    draw(`Пол: ${sexRu(profile.biologicalSex)}`);
    draw(`Возраст (полных лет): ${age != null ? String(age) : "не указан"}`);
    draw(
      `Антропометрия: рост ${profile.heightCm != null ? `${profile.heightCm} см` : "—"}, вес ${
        profile.weightKg != null ? `${profile.weightKg} кг` : "—"
      }, ИМТ ${bmiStr}, группа крови ${profile.bloodType?.trim() || "—"}`,
    );
    y -= 6;

    draw("2. Сведения из медкарточки (самоотчёт пользователя)", 12, true);
    if (profile.medCardIsDoctor) {
      draw(`Отмечено: работа в медицине (врач). ${profile.medCardDoctorNote?.trim() || ""}`.trim());
    }
    if (profile.medCardIsCaregiver) {
      draw(
        `Отмечено: сиделка / уход. ${profile.medCardCaregiverNote?.trim() || ""}`.trim(),
      );
    }
    if (!profile.medCardIsDoctor && !profile.medCardIsCaregiver) {
      draw("Отдельные пометки не указаны.");
    }
    y -= 6;

    draw("3. Постоянный приём лекарственных средств (по данным профиля)", 12, true);
    if (!profile.medications.length) {
      draw("Не указано.");
    } else {
      for (const m of profile.medications) {
        draw(`• ${m.name} — ${m.dosage} (${m.timeOfDay})`);
      }
    }
    y -= 6;

    draw("4. Архив документов в SakBol (количество по типам)", 12, true);
    for (const cat of Object.keys(DOC_CAT_RU) as HealthDocumentCategory[]) {
      const n = docCounts.get(cat) ?? 0;
      if (n > 0) draw(`• ${DOC_CAT_RU[cat]}: ${n}`);
    }
    if (profile.healthDocuments.length === 0) {
      draw("Документов в архиве нет.");
    }
    y -= 6;

    draw("5. Лабораторные исследования (распознанные показатели в приложении)", 12, true);
    if (!profile.healthRecords.length) {
      draw("Загруженных анализов пока нет.");
    } else {
      for (const rec of profile.healthRecords) {
        const payload = resolveLabAnalysisPayload(rec.data, rec.metrics?.payload ?? null);
        const title =
          rec.title?.trim() ||
          `Анализ от ${rec.createdAt.toISOString().slice(0, 10)}`;
        draw(title, 11, true);
        if (!payload.biomarkers.length) {
          draw("  (показатели не извлечены)");
        } else {
          for (const bm of payload.biomarkers.slice(0, 40)) {
            draw(
              `  • ${bm.biomarker}: ${bm.value} ${bm.unit} (реф.: ${bm.reference})`,
              10,
            );
          }
          if (payload.biomarkers.length > 40) {
            draw(`  … и ещё ${payload.biomarkers.length - 40} показателей (полный список в приложении).`, 9);
          }
        }
        y -= 4;
      }
    }

    y -= 6;
    draw(
      "Интерпретация и клинические решения остаются за лечащим врачом. SakBol не ставит диагнозов.",
      9,
    );

    const bytes = await pdf.save();
    const filename = `sakbol-medical-report-${anonymId}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/profile/[profileId]/doctor-report/pdf", e);
    const msg = e instanceof Error ? e.message : "PDF generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
