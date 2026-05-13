"use client";

import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import type { LabAnalysisRow } from "@/types/family";
import { Download } from "lucide-react";

type Props = {
  analyses: LabAnalysisRow[];
  displayName?: string;
};

export function ArchiveExportButton({ analyses, displayName = "Patient" }: Props) {
  const { lang } = useLanguage();

  const handleExport = () => {
    if (!analyses.length) return;

    // Сбор данных всех биомаркеров в плоскую таблицу
    const rows: string[][] = [["Date", "Title", "Biomarker", "Value", "Unit", "Reference"]];

    for (const a of analyses) {
      const data = a.data as { biomarkers?: Array<{ biomarker: string; value: number; unit: string; reference: string }> };
      if (!data.biomarkers) continue;

      for (const b of data.biomarkers) {
        rows.push([
          new Date(a.createdAt).toLocaleDateString(),
          a.title || "",
          b.biomarker,
          String(b.value),
          b.unit,
          b.reference,
        ]);
      }
    }

    const csvContent = rows.map((r) => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SakBol_Archive_${displayName}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex items-center gap-2 rounded-xl bg-ui-border-subtle px-4 py-2 text-sm font-medium text-ui-foreground transition-colors hover:bg-ui-border"
      title={t(lang, "analyses.exportCsv")}
    >
      <Download className="h-4 w-4" />
      {t(lang, "analyses.exportCsv")}
    </button>
  );
}
