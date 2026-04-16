"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { LabAnalysisRow } from "@/types/family";
import {
  buildAnalysisCompareRows,
  orderAnalysesChronologically,
  type AnalysisCompareRow,
} from "@/lib/analysis-compare";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DsCard } from "@/components/ui/ds-card";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import type { MedicalStatus } from "@/lib/medical-logic";

type Props = {
  analyses: LabAnalysisRow[];
  activeDob: string | null;
  /** Сброс выбора при обновлении списка. */
  refreshKey?: number;
};

function statusDotClass(st: MedicalStatus): string {
  if (st === "critical") return "bg-health-danger";
  if (st === "warning") return "bg-health-warning";
  return "bg-health-positive";
}

function formatDelta(
  delta: number | null,
  deltaPct: number | null,
  unit: string,
  lang: string,
): string {
  if (delta == null) return "—";
  const sign = delta > 0 ? "+" : "";
  const pct =
    deltaPct != null && Number.isFinite(deltaPct)
      ? ` (${sign}${deltaPct.toFixed(1)}%)`
      : "";
  const u = unit ? ` ${unit}` : "";
  return `${sign}${delta.toLocaleString(lang === "ru" ? "ru-RU" : "ky-KG", { maximumFractionDigits: 3 })}${u}${pct}`;
}

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCompareCsv(
  rows: AnalysisCompareRow[],
  baseline: LabAnalysisRow,
  followup: LabAnalysisRow,
  lang: string,
  headers: { biomarker: string; was: string; now: string; delta: string },
) {
  const loc = lang === "ru" ? "ru-RU" : "ky-KG";
  const fmtDate = (iso: string) =>
    new Date(iso)
      .toLocaleDateString(loc, { day: "2-digit", month: "short", year: "numeric" })
      .replace(/\s+/g, "_");

  const head = [headers.biomarker, headers.was, headers.now, headers.delta];
  const body = rows.map((row) => {
    const was =
      row.earlierVal != null
        ? `${row.earlierVal}${row.unit ? ` ${row.unit}` : ""}`
        : "—";
    const now =
      row.laterVal != null ? `${row.laterVal}${row.unit ? ` ${row.unit}` : ""}` : "—";
    const deltaStr = formatDelta(row.delta, row.deltaPct, row.unit, lang);
    return [row.label, was, now, deltaStr].map(escapeCsvCell).join(",");
  });
  const lines = [head.map(escapeCsvCell).join(","), ...body];
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sakbol-compare-${fmtDate(baseline.createdAt)}-${fmtDate(followup.createdAt)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnalysisComparePanel({ analyses, activeDob, refreshKey = 0 }: Props) {
  const { lang } = useLanguage();
  const sorted = useMemo(
    () => [...analyses].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [analyses],
  );

  const idsKey = sorted.map((r) => r.id).join("|");

  const [idA, setIdA] = useState(() => sorted[0]?.id ?? "");
  const [idB, setIdB] = useState(() => sorted[Math.max(0, sorted.length - 1)]?.id ?? "");

  useEffect(() => {
    if (sorted.length < 2) return;
    setIdA(sorted[0].id);
    setIdB(sorted[sorted.length - 1].id);
  }, [refreshKey, idsKey, sorted]);

  const rowA = sorted.find((r) => r.id === idA);
  const rowB = sorted.find((r) => r.id === idB);

  const { baseline, followup } = useMemo(() => {
    if (!rowA || !rowB || rowA.id === rowB.id) return { baseline: null as LabAnalysisRow | null, followup: null as LabAnalysisRow | null };
    return orderAnalysesChronologically(rowA, rowB);
  }, [rowA, rowB]);

  const compareRows = useMemo(() => {
    if (!baseline || !followup) return [];
    return buildAnalysisCompareRows(baseline, followup, activeDob);
  }, [baseline, followup, activeDob]);

  if (sorted.length < 2) {
    return (
      <DsCard variant="muted" className="p-4">
        <p className="text-body text-health-text-secondary">{t(lang, "analyses.compareNeedTwo")}</p>
      </DsCard>
    );
  }

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ru" ? "ru-RU" : "ky-KG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const selectCls =
    "w-full min-h-[44px] rounded-xl border-0 bg-slate-50 px-3 py-2 text-body text-health-text shadow-sm ring-1 ring-health-border/80 focus:ring-2 focus:ring-health-primary";

  return (
    <DsCard className="overflow-hidden p-0">
      <div className="border-b border-health-border/60 bg-gradient-to-r from-teal-50/50 to-health-surface px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-manrope text-h3 font-semibold text-health-text">{t(lang, "analyses.compareTitle")}</h3>
            <p className="mt-1 text-caption text-health-text-secondary">{t(lang, "analyses.compareSubtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {baseline && followup && compareRows.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  downloadCompareCsv(compareRows, baseline, followup, lang, {
                    biomarker: t(lang, "analyses.compareBiomarker"),
                    was: t(lang, "analyses.compareWas"),
                    now: t(lang, "analyses.compareNow"),
                    delta: t(lang, "analyses.compareDelta"),
                  })
                }
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-health-surface px-3 py-2 text-caption font-semibold text-health-primary shadow-sm ring-1 ring-teal-100 transition-colors hover:bg-teal-50/90"
              >
                <Download className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                {t(lang, "analyses.exportCsv")}
              </button>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full bg-health-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-health-primary ring-1 ring-teal-100">
              <MaterialIcon name="compare_arrows" className="text-[14px]" />
              {t(lang, "analyses.compareBadge")}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-health-text-secondary">
              {t(lang, "analyses.comparePickFirst")}
            </span>
            <select className={selectCls} value={idA} onChange={(e) => setIdA(e.target.value)}>
              {sorted.map((r) => (
                <option key={r.id} value={r.id}>
                  {dateFmt(r.createdAt)}
                  {r.title ? ` — ${r.title}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-health-text-secondary">
              {t(lang, "analyses.comparePickSecond")}
            </span>
            <select className={selectCls} value={idB} onChange={(e) => setIdB(e.target.value)}>
              {sorted.map((r) => (
                <option key={r.id} value={r.id}>
                  {dateFmt(r.createdAt)}
                  {r.title ? ` — ${r.title}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {rowA && rowB && rowA.id === rowB.id ? (
          <p className="mt-3 text-caption font-medium text-health-warning">{t(lang, "analyses.compareSameRecord")}</p>
        ) : baseline && followup ? (
          <p className="mt-3 text-caption text-health-text-secondary">
            <span className="font-medium text-health-text">{t(lang, "analyses.compareTimeline")}</span>{" "}
            {dateFmt(baseline.createdAt)} → {dateFmt(followup.createdAt)}
          </p>
        ) : null}
      </div>

      <div className="max-h-[min(70vh,32rem)] overflow-auto px-2 pb-4 pt-3 sm:px-4">
        {rowA && rowB && rowA.id === rowB.id ? null : compareRows.length === 0 ? (
          <p className="px-2 py-6 text-center text-body text-health-text-secondary">
            {t(lang, "analyses.compareNoMarkers")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
                  <th className="sticky top-0 z-[1] bg-health-surface py-2 pl-2 pr-2">{t(lang, "analyses.compareBiomarker")}</th>
                  <th className="sticky top-0 z-[1] bg-health-surface py-2 px-2">
                    {t(lang, "analyses.compareWas")}
                    {baseline ? (
                      <span className="mt-0.5 block font-normal normal-case text-health-text-secondary">
                        {dateFmt(baseline.createdAt)}
                      </span>
                    ) : null}
                  </th>
                  <th className="sticky top-0 z-[1] bg-health-surface py-2 px-2">
                    {t(lang, "analyses.compareNow")}
                    {followup ? (
                      <span className="mt-0.5 block font-normal normal-case text-health-text-secondary">
                        {dateFmt(followup.createdAt)}
                      </span>
                    ) : null}
                  </th>
                  <th className="sticky top-0 z-[1] bg-health-surface py-2 pr-2 pl-2">{t(lang, "analyses.compareDelta")}</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr
                    key={`${row.label}-${row.unit}`}
                    className="border-t border-health-border/50 transition-colors hover:bg-slate-50/80"
                  >
                    <td className="py-2.5 pl-2 pr-2 font-medium text-health-text">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-health-border" />
                        {row.label}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 tabular-nums text-health-text">
                      {row.earlierVal != null ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass(row.statusEarlier))} />
                          {row.earlierVal.toLocaleString(lang === "ru" ? "ru-RU" : "ky-KG", { maximumFractionDigits: 3 })}
                          {row.unit ? ` ${row.unit}` : ""}
                        </span>
                      ) : (
                        <span className="text-health-text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums text-health-text">
                      {row.laterVal != null ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass(row.statusLater))} />
                          {row.laterVal.toLocaleString(lang === "ru" ? "ru-RU" : "ky-KG", { maximumFractionDigits: 3 })}
                          {row.unit ? ` ${row.unit}` : ""}
                        </span>
                      ) : (
                        <span className="text-health-text-secondary">—</span>
                      )}
                    </td>
                    <td className="pr-2 pl-2 py-2.5">
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          row.delta == null
                            ? "text-health-text-secondary"
                            : row.delta > 0
                              ? "text-teal-800"
                              : row.delta < 0
                                ? "text-sky-800"
                                : "text-health-text-secondary",
                        )}
                      >
                        {formatDelta(row.delta, row.deltaPct, row.unit, lang)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="border-t border-health-border/50 px-4 py-2 text-[10px] leading-tight text-health-text-secondary sm:px-5">
        {t(lang, "analyses.compareDisclaimer")}
      </p>
    </DsCard>
  );
}
