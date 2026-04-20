"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, PlusCircle, Stethoscope, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { listLabAnalysesForProfile } from "@/app/actions/analyses";
import { deleteLabAnalysis } from "@/app/actions/health-record";
import { createShareToken } from "@/app/actions/share";
import { useLanguage } from "@/context/language-context";
import type { LabAnalysisRow, ProfileSummary } from "@/types/family";
import { useActiveProfile } from "@/context/active-profile-context";
import type { HealthRecordAnalysisPayload } from "@/types/biomarker";
import { AnalysisSkeleton } from "@/components/analysis-skeleton";
import { BiomarkerChart } from "@/components/biomarker-chart";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import {
  analysisWorstStatus,
  buildBiomarkerSeries,
  getNormForBiomarker,
  getStatusColorHex,
  ageInMonthsFromDob,
  listBiomarkersWithDynamics,
  normalizeBiomarkerKey,
  statusForBiomarker,
  unitForBiomarkerKey,
  type MedicalStatus,
} from "@/lib/medical-logic";
import type { ParsedBiomarker } from "@/types/biomarker";
import { categoryForBiomarkerKey } from "@/constants/biomarker-categories";
import { downloadLabPdfClient } from "@/lib/download-lab-pdf";
import { AnalysisComparePanel } from "@/components/analysis-compare-panel";
import { effectiveAnalysisTimeMs } from "@/lib/lab-analysis-dates";

function biomarkerCount(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const d = data as HealthRecordAnalysisPayload;
  return Array.isArray(d.biomarkers) ? d.biomarkers.length : null;
}

function fileTypeLabel(mime: string | undefined): string {
  if (!mime) return "—";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("image")) return "IMG";
  const p = mime.split("/").pop();
  return p ? p.toUpperCase() : "—";
}

function labNameFromRow(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const n = d.labName;
  return typeof n === "string" && n.trim() ? n.trim() : null;
}

function cardTone(worst: MedicalStatus): string {
  if (worst === "critical") {
    return "bg-red-50/90 shadow-md ring-1 ring-red-200/80";
  }
  if (worst === "warning") {
    return "bg-amber-50/70 shadow-md ring-1 ring-amber-200/70";
  }
  return "bg-health-surface shadow-md ring-1 ring-health-border/80";
}

function statusIndicatorPillClass(st: MedicalStatus): string {
  if (st === "critical") return "bg-red-100 text-red-900 ring-1 ring-red-200/70";
  if (st === "warning") return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/70";
  return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70";
}

type Props = {
  profiles: ProfileSummary[];
  refreshKey?: number;
  /** Пустой список: кнопка «жүктөө» открывает загрузку (родитель). */
  onRequestUpload?: () => void;
  /** Десктоп: уместить в одну колонку без прокрутки — до 2 карточек, без динамики и лишнего текста */
  compact?: boolean;
  /** В compact при клике по карточке — перейти к полной вкладке анализов */
  onOpenAnalyses?: () => void;
  /** Вкладка «Динамика»: только сравнение и графики, без списка карточек. */
  mode?: "default" | "trends";
  /** Скрыть H2 и подпись (родитель уже дал контекст, напр. блок «Обследования»). */
  hideHeader?: boolean;
  /** Архив: без фильтров по «норма/критично» и без цветовых статусов в списке. */
  archiveNeutral?: boolean;
};

export function AnalysesPreview({
  profiles,
  refreshKey = 0,
  onRequestUpload,
  compact = false,
  onOpenAnalyses,
  mode = "default",
  hideHeader = false,
  archiveNeutral = false,
}: Props) {
  const { lang } = useLanguage();
  const { activeProfileId } = useActiveProfile();
  const isTrends = mode === "trends";
  const [rows, setRows] = useState<LabAnalysisRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeShare, setActiveShare] = useState<{ recordId: string; url: string } | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<{ id: string; msg: string } | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | MedicalStatus>("all");
  const [trendsRangeDays, setTrendsRangeDays] = useState<number | null>(null);
  const [trendsFocusKey, setTrendsFocusKey] = useState<string | null>(null);

  const activeDob = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.id === activeProfileId)?.dateOfBirth ?? null;
  }, [profiles, activeProfileId]);

  const ageMonths = useMemo(() => ageInMonthsFromDob(activeDob), [activeDob]);

  useEffect(() => {
    if (!activeProfileId) {
      setRows(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listLabAnalysesForProfile(activeProfileId)
      .then((d) => {
        if (cancelled) return;
        if (!d.ok) {
          throw new Error(d.error);
        }
        setRows(d.analyses);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t(lang, "analyses.errorLoad"));
        setRows(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, refreshKey, lang]);

  useEffect(() => {
    setStatusFilter("all");
  }, [activeProfileId, refreshKey]);

  const listSourceRows = useMemo(() => {
    if (!rows?.length) return rows;
    if (!isTrends) return rows;
    if (trendsRangeDays == null) return rows;
    const cutoff = Date.now() - trendsRangeDays * 86400000;
    return rows.filter((r) => effectiveAnalysisTimeMs(r) >= cutoff);
  }, [rows, isTrends, trendsRangeDays]);

  const dynamicsKeys = useMemo(
    () => (listSourceRows?.length ? listBiomarkersWithDynamics(listSourceRows, 2) : []),
    [listSourceRows],
  );

  useEffect(() => {
    if (trendsFocusKey && !dynamicsKeys.includes(trendsFocusKey)) {
      setTrendsFocusKey(null);
    }
  }, [dynamicsKeys, trendsFocusKey]);

  const dynamicsKeysFiltered = useMemo(() => {
    if (!trendsFocusKey || !dynamicsKeys.includes(trendsFocusKey)) return dynamicsKeys;
    return [trendsFocusKey];
  }, [dynamicsKeys, trendsFocusKey]);

  const filteredRows = useMemo(() => {
    if (!listSourceRows?.length) return listSourceRows;
    if (!activeProfileId || compact || statusFilter === "all" || isTrends || archiveNeutral) {
      return listSourceRows;
    }
    return listSourceRows.filter((a) => analysisWorstStatus(a.data, activeDob) === statusFilter);
  }, [listSourceRows, activeProfileId, compact, statusFilter, activeDob, isTrends, archiveNeutral]);

  if (!activeProfileId) return null;

  const rowsForUi = compact ? filteredRows?.slice(0, 2) : filteredRows;

  const filterKeys = [
    { id: "all" as const, label: t(lang, "analyses.filterAll") },
    { id: "critical" as const, label: t(lang, "analyses.filterCritical") },
    { id: "warning" as const, label: t(lang, "analyses.filterWarning") },
    { id: "normal" as const, label: t(lang, "analyses.filterNormal") },
  ];

  const trendDeltaInsight = (series: { value: number }[]) => {
    if (series.length < 2) return t(lang, "dynamics.insightStable");
    const a = series[series.length - 2]?.value;
    const b = series[series.length - 1]?.value;
    if (typeof a !== "number" || typeof b !== "number") return t(lang, "dynamics.insightStable");
    if (a === 0) return t(lang, "dynamics.insightStable");
    const pct = ((b - a) / Math.abs(a)) * 100;
    if (Math.abs(pct) < 2) return t(lang, "dynamics.insightStable");
    if (b > a) return t(lang, "dynamics.insightRising");
    return t(lang, "dynamics.insightFalling");
  };

  return (
    <section
      className={cn(
        "transition-shadow duration-300",
        isTrends && !compact
          ? "space-y-4 bg-transparent p-0 shadow-none ring-0"
          : "rounded-2xl bg-health-surface shadow-md shadow-slate-900/[0.06] ring-1 ring-health-border/80 backdrop-blur-sm",
        compact ? "flex h-full min-h-0 flex-col overflow-hidden p-2" : !isTrends && "p-4 sm:p-5",
      )}
    >
      {!hideHeader ? (
        <>
          <h2
            className={cn(
              "font-manrope font-semibold text-health-text",
              compact ? "text-xs" : "text-h3",
            )}
          >
            {isTrends ? t(lang, "trends.pageTitle") : t(lang, "analyses.title")}
          </h2>
          {!compact ? (
            isTrends ? (
              <p className="mt-1 text-body text-health-text-secondary">{t(lang, "trends.pageSubtitle")}</p>
            ) : archiveNeutral ? (
              <p className="mt-1 text-body text-health-text-secondary">{t(lang, "analyses.archiveSubtitle")}</p>
            ) : (
              <>
                <p className="mt-1 text-body text-health-text-secondary">{t(lang, "analyses.subtitle")}</p>
                <p className="mt-1 text-caption leading-relaxed text-health-text-secondary/90">
                  {t(lang, "analyses.labsBrands")}
                </p>
              </>
            )
          ) : (
            <p className="mt-0.5 truncate text-[10px] text-health-text-secondary">
              {archiveNeutral && !isTrends ? t(lang, "analyses.archiveSubtitle") : t(lang, "analyses.subtitle")}
            </p>
          )}
        </>
      ) : null}

      {isTrends && !compact ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-md shadow-slate-900/[0.04] ring-1 ring-health-border/80">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { days: null as number | null, key: "all" },
                { days: 90, key: "3m" },
                { days: 180, key: "6m" },
                { days: 365, key: "1y" },
              ] as const
            ).map(({ days, key }) => {
              const active =
                (days === null && trendsRangeDays === null) ||
                (days !== null && trendsRangeDays === days);
              const label =
                key === "all"
                  ? t(lang, "dynamics.rangeAll")
                  : key === "3m"
                    ? t(lang, "dynamics.range3m")
                    : key === "6m"
                      ? t(lang, "dynamics.range6m")
                      : t(lang, "dynamics.range1y");
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTrendsRangeDays(days)}
                  className={cn(
                    "min-h-[44px] rounded-xl px-4 text-caption font-semibold transition-colors",
                    active
                      ? "bg-teal-50 text-health-primary shadow-sm ring-1 ring-teal-200"
                      : "bg-slate-50 text-health-text-secondary hover:bg-slate-100",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {dynamicsKeys.length > 0 ? (
            <label className="flex flex-col gap-1 text-caption font-medium text-health-text-secondary">
              <span>{t(lang, "dynamics.selectMetric")}</span>
              <select
                value={trendsFocusKey ?? ""}
                onChange={(e) => setTrendsFocusKey(e.target.value === "" ? null : e.target.value)}
                className="min-h-[44px] rounded-xl border-0 bg-slate-50 px-3 text-body text-health-text shadow-sm ring-1 ring-health-border/80"
              >
                <option value="">{t(lang, "dynamics.metricAll")}</option>
                {dynamicsKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {!archiveNeutral && !isTrends && !compact && rows && rows.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {filterKeys.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-caption font-semibold transition-all duration-300",
                statusFilter === id
                  ? "bg-health-primary text-white shadow-sm"
                  : "bg-slate-100 text-health-text-secondary hover:bg-slate-200/90",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <AnalysisSkeleton className={compact ? "mt-2" : "mt-3"} />
      ) : error ? (
        <p className={cn("text-health-danger", compact ? "mt-2 text-xs" : "mt-3 text-sm")}>{error}</p>
      ) : rows?.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center text-center",
            compact ? "mt-2 px-2 py-4" : "mt-6 px-4 py-10",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-100/80 shadow-inner ring-1 ring-teal-100/80",
              compact ? "h-10 w-10" : "h-16 w-16",
            )}
          >
            <Stethoscope
              className="text-health-primary/70"
              size={compact ? 22 : 36}
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
          <h3
            className={cn(
              "font-manrope font-semibold text-health-text",
              compact ? "mt-2 text-xs" : "mt-4 text-base",
            )}
          >
            {t(lang, "analyses.emptyPrimary")}
          </h3>
          <p
            className={cn(
              "text-health-text-secondary",
              compact ? "mt-1 max-w-xs text-[10px]" : "mt-2 max-w-sm text-body",
            )}
          >
            {t(lang, "analyses.emptySecondary")}
          </p>
          {onRequestUpload ? (
            <button
              type="button"
              onClick={onRequestUpload}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl bg-health-primary font-semibold text-white shadow-md shadow-teal-900/15 transition-all duration-300 hover:bg-teal-700",
                compact ? "mt-2 px-3 py-1.5 text-[11px]" : "mt-5 px-6 py-3 text-sm",
              )}
            >
              <PlusCircle size={compact ? 14 : 16} strokeWidth={2} aria-hidden />
              {t(lang, "tests.uploadBig")}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {!compact && isTrends && listSourceRows && listSourceRows.length > 0 ? (
            <div className="mt-4">
              <AnalysisComparePanel
                analyses={listSourceRows}
                activeDob={activeDob}
                refreshKey={refreshKey}
              />
            </div>
          ) : null}
          {!isTrends && !rowsForUi?.length ? (
            <div
              className={cn(
                "rounded-xl bg-slate-50/90 text-center text-health-text-secondary ring-1 ring-health-border/70",
                compact ? "mt-2 px-3 py-6 text-xs" : "mt-4 px-4 py-10 text-body",
              )}
            >
              {t(lang, "analyses.filterEmpty")}
            </div>
          ) : null}
          {!isTrends && rowsForUi?.length ? (
            <ul
              className={cn(
                "grid gap-2",
                compact
                  ? "mt-2 min-h-0 flex-1 grid-cols-1 overflow-hidden"
                  : "mt-4 grid-cols-1 gap-3 sm:grid-cols-2",
              )}
            >
          {rowsForUi?.map((a, idx) => {
            const n = biomarkerCount(a.data);
            const worst = analysisWorstStatus(a.data, activeDob);
            const open = !compact && expandedId === a.id;
            const payload =
              a.data && typeof a.data === "object"
                ? (a.data as HealthRecordAnalysisPayload)
                : null;

            return (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: idx * 0.05, ease: "easeOut" }}
                className={cn(
                  "rounded-2xl text-health-text transition-all duration-300 hover:shadow-lg",
                  compact ? "px-2.5 py-2 text-xs" : "px-4 py-3 text-sm",
                  archiveNeutral && !isTrends
                    ? "bg-white shadow-sm ring-1 ring-slate-200/90"
                    : cardTone(worst),
                )}
              >
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 min-h-[3rem] flex-1 items-start justify-between gap-2 text-left"
                    onClick={() => {
                      if (compact && onOpenAnalyses) {
                        onOpenAnalyses();
                        return;
                      }
                      setExpandedId(open ? null : a.id);
                    }}
                    aria-expanded={open}
                  >
                    <span>
                      <span
                        className="font-semibold text-health-text"
                        style={
                          archiveNeutral && !isTrends
                            ? undefined
                            : { borderBottom: `2px solid ${getStatusColorHex(worst)}` }
                        }
                      >
                        {a.title ?? t(lang, "analyses.analysis")}
                      </span>
                      {n != null ? (
                        <span className="ml-2 text-xs text-health-text-secondary">
                          {n} {t(lang, "analyses.indicators")}
                        </span>
                      ) : null}
                      {a.isPrivate ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-950 ring-1 ring-amber-200/70">
                          {t(lang, "analyses.private")}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-health-text-secondary">
                        {new Date(effectiveAnalysisTimeMs(a)).toLocaleDateString(
                          lang === "ru" ? "ru-RU" : "ky-KG",
                        )}
                        {archiveNeutral && !isTrends && payload ? (
                          <span className="mt-0.5 block text-[11px] text-health-text-secondary/90">
                            {(labNameFromRow(a.data) ?? "—") + " · " + fileTypeLabel(payload.mimeType)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {!compact ? (
                      open ? (
                        <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-health-primary" />
                      ) : (
                        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-health-primary" />
                      )
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={deleteBusyId === a.id}
                    title={t(lang, "analyses.delete")}
                    aria-label={t(lang, "analyses.delete")}
                    className={cn(
                      "flex min-w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-red-50/90 px-2 py-1.5 text-red-800 ring-1 ring-red-200/80 shadow-sm transition-colors hover:bg-red-100/90 disabled:opacity-50 sm:min-w-[4.5rem] sm:flex-row sm:gap-1 sm:px-2.5",
                      compact && "min-w-10 px-1.5 py-1",
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!window.confirm(t(lang, "analyses.deleteConfirm"))) return;
                      setDeleteBusyId(a.id);
                      void deleteLabAnalysis(a.id)
                        .then((r) => {
                          if (!r.ok) {
                            setError(r.error);
                            return;
                          }
                          setRows((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
                          setExpandedId((ex) => (ex === a.id ? null : ex));
                          setActiveShare((s) => (s?.recordId === a.id ? null : s));
                        })
                        .finally(() => setDeleteBusyId(null));
                    }}
                  >
                    {deleteBusyId === a.id ? (
                      <Loader2 className={cn("animate-spin", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                    ) : (
                      <Trash2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
                    )}
                    <span
                      className={cn(
                        "max-w-[3.5rem] text-center text-[9px] font-bold uppercase leading-tight text-red-800 sm:max-w-none sm:text-[10px]",
                        compact && "sr-only",
                      )}
                    >
                      {t(lang, "analyses.delete")}
                    </span>
                  </button>
                </div>

                {open ? (
                  <div className="mt-2 border-t border-health-border/60 pt-3">
                    {payload?.biomarkers && payload.biomarkers.length > 0 ? (
                      archiveNeutral || isTrends ? (
                        <>
                          <p className="mb-2 text-[11px] font-semibold text-slate-800">
                            {lang === "ru" ? "Показатели" : "Көрсөткүчтөр"} · {payload.biomarkers.length}
                          </p>
                          <ul className="max-h-[min(60vh,28rem)] space-y-1 overflow-y-auto pr-0.5">
                            {[...payload.biomarkers]
                              .sort((x, y) =>
                                x.biomarker.localeCompare(y.biomarker, lang === "ru" ? "ru" : "ky"),
                              )
                              .map((b: ParsedBiomarker, idx: number) => {
                                const nk = normalizeBiomarkerKey(b.biomarker);
                                const catId = nk ? categoryForBiomarkerKey(nk) : "other";
                                return (
                                  <li
                                    key={`${a.id}-${idx}-${b.biomarker}`}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/90 px-2 py-1.5 text-xs ring-1 ring-slate-200/80"
                                  >
                                    <span className="min-w-0 text-slate-700">
                                      <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                        {t(lang, `category.${catId}`)}
                                      </span>
                                      <span className="font-medium text-slate-900">
                                        {b.biomarker}:{" "}
                                        <strong className="text-slate-900">
                                          {b.value} {b.unit}
                                        </strong>
                                      </span>
                                    </span>
                                  </li>
                                );
                              })}
                          </ul>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const ranked = [...payload.biomarkers].sort((x, y) => {
                              const rank: Record<MedicalStatus, number> = {
                                critical: 0,
                                warning: 1,
                                normal: 2,
                              };
                              return (
                                rank[statusForBiomarker(x, activeDob)] -
                                rank[statusForBiomarker(y, activeDob)]
                              );
                            });
                            const critical = ranked.filter(
                              (b) => statusForBiomarker(b, activeDob) === "critical",
                            );
                            const warning = ranked.filter(
                              (b) => statusForBiomarker(b, activeDob) === "warning",
                            );
                            const normal = ranked.filter(
                              (b) => statusForBiomarker(b, activeDob) === "normal",
                            );

                            return (
                              <>
                                <p className="mb-2 text-[11px] font-semibold text-slate-800">
                                  Все показатели · {ranked.length}{" "}
                                  <span className="font-normal text-slate-500">
                                    (сначала отклонения от нормы)
                                  </span>
                                </p>
                                <ul className="max-h-[min(60vh,28rem)] space-y-1 overflow-y-auto pr-0.5">
                                  {ranked.map((b: ParsedBiomarker, idx: number) => {
                                    const st = statusForBiomarker(b, activeDob);
                                    const nk = normalizeBiomarkerKey(b.biomarker);
                                    const catId = nk ? categoryForBiomarkerKey(nk) : "other";
                                    return (
                                      <li
                                        key={`${a.id}-${idx}-${b.biomarker}`}
                                        className={cn(
                                          "flex items-center justify-between gap-2 rounded-lg border-l-4 px-2 py-1.5 text-xs",
                                          st === "critical" && "border-l-red-500 bg-[#fff4f4]",
                                          st === "warning" && "border-l-amber-500 bg-amber-50/80",
                                          st === "normal" && "border-l-emerald-200 bg-white/60",
                                        )}
                                      >
                                        <span className="min-w-0 text-slate-700">
                                          <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                            {t(lang, `category.${catId}`)}
                                          </span>
                                          <span className="font-medium text-slate-900">
                                            {b.biomarker}:{" "}
                                            <strong
                                              className={cn(
                                                st === "critical" && "text-red-800",
                                                st === "warning" && "text-amber-900",
                                                st === "normal" && "text-slate-900",
                                              )}
                                            >
                                              {b.value} {b.unit}
                                            </strong>
                                          </span>
                                        </span>
                                        <span
                                          className={cn(
                                            "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                            statusIndicatorPillClass(st),
                                          )}
                                        >
                                          {t(lang, `status.${st}`)}
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>

                                <div
                                  className={cn(
                                    "mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed",
                                    critical.length > 0
                                      ? "bg-red-50/90 text-red-900 ring-1 ring-red-200/80"
                                      : warning.length > 0
                                        ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200/70"
                                        : "bg-emerald-50/70 text-emerald-900 ring-1 ring-emerald-200/60",
                                  )}
                                >
                                  <p className="font-semibold">
                                    {critical.length > 0
                                      ? "🔴 Критические отклонения"
                                      : warning.length > 0
                                        ? "🟡 Незначительные отклонения"
                                        : "🟢 Все показатели в норме"}
                                  </p>
                                  <p className="mt-1 text-[11px] opacity-85">
                                    {critical.length > 0
                                      ? `${critical.map((b) => b.biomarker).join(", ")} — значительно выходит за пределы нормы. Рекомендуем обратиться к врачу.`
                                      : warning.length > 0
                                        ? `${warning.map((b) => b.biomarker).join(", ")} — на границе нормы. Рекомендуем повторный анализ через 1–2 месяца.`
                                        : `${normal.length} показателей в пределах нормы. Продолжайте мониторинг.`}
                                  </p>
                                  <p className="mt-1.5 text-[10px] opacity-60">
                                    Не является медицинским диагнозом. Консультируйтесь с врачом.
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </>
                      )
                    ) : (
                      <p className="py-2 text-xs text-slate-500">
                        Показатели в этой записи не найдены или ещё обрабатываются.
                      </p>
                    )}

                    <div
                      className={cn(
                        "mt-3 flex flex-wrap gap-2",
                        !compact && "pb-[max(5.5rem,env(safe-area-inset-bottom,0px))] sm:pb-2",
                      )}
                    >
                      <button
                        type="button"
                        className="rounded-lg bg-health-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
                        onClick={async () => {
                          const res = await createShareToken(a.id);
                          if (!res.ok) return;
                          const url = `${window.location.origin}/share/${res.token}`;
                          setActiveShare({ recordId: a.id, url });
                        }}
                      >
                        {t(lang, "analyses.shareDoctor")}
                      </button>
                      <button
                        type="button"
                        disabled={pdfBusyId === a.id}
                        className="rounded-lg border border-health-border bg-health-surface px-3 py-1.5 text-xs font-medium text-health-text shadow-sm disabled:opacity-50"
                        onClick={() => {
                          setPdfError(null);
                          setPdfBusyId(a.id);
                          void downloadLabPdfClient(a.id)
                            .then((r) => {
                              if (!r.ok) setPdfError({ id: a.id, msg: r.error });
                            })
                            .finally(() => setPdfBusyId(null));
                        }}
                      >
                        {pdfBusyId === a.id ? "…" : t(lang, "analyses.downloadPdf")}
                      </button>
                    </div>

                    {!compact ? (
                      <button
                        type="button"
                        disabled={deleteBusyId === a.id}
                        className="mt-3 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-sm font-semibold text-red-900 ring-1 ring-red-200/80 shadow-sm transition-colors hover:bg-red-100/90 disabled:opacity-50"
                        onClick={() => {
                          if (!window.confirm(t(lang, "analyses.deleteConfirm"))) return;
                          setDeleteBusyId(a.id);
                          void deleteLabAnalysis(a.id)
                            .then((r) => {
                              if (!r.ok) {
                                setError(r.error);
                                return;
                              }
                              setRows((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
                              setExpandedId((ex) => (ex === a.id ? null : ex));
                              setActiveShare((s) => (s?.recordId === a.id ? null : s));
                            })
                            .finally(() => setDeleteBusyId(null));
                        }}
                      >
                        {deleteBusyId === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                        )}
                        {t(lang, "analyses.delete")}
                      </button>
                    ) : null}

                    {pdfError?.id === a.id ? (
                      <p className="mt-2 text-xs text-red-700">{pdfError.msg}</p>
                    ) : null}
                    {activeShare?.recordId === a.id ? (
                      <div className="mt-3 rounded-xl bg-health-surface p-3 ring-1 ring-health-border/80">
                        <p className="text-xs font-semibold text-health-text">{t(lang, "analyses.qrTitle")}</p>
                        <p className="text-[11px] text-health-text-secondary">{t(lang, "analyses.qrHint")}</p>
                        <div className="mt-2 flex justify-center rounded-lg bg-white p-2">
                          <QRCodeSVG value={activeShare.url} size={168} level="M" includeMargin />
                        </div>
                        <a
                          className="mt-2 block break-all text-xs font-medium text-health-primary underline decoration-teal-200 underline-offset-2"
                          href={activeShare.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {activeShare.url}
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </motion.li>
            );
          })}
            </ul>
          ) : null}
        </>
      )}

      {compact && rows && rows.length > 2 && onOpenAnalyses ? (
        <button
          type="button"
          onClick={onOpenAnalyses}
          className="mt-1.5 shrink-0 rounded-xl bg-teal-50 py-2 text-center text-caption font-semibold text-health-primary ring-1 ring-teal-100 transition-colors hover:bg-teal-100/80"
        >
          {t(lang, "analyses.viewAll")}
          <span className="text-health-text-secondary"> · +{rows.length - 2}</span>
        </button>
      ) : null}

      {!compact &&
      isTrends &&
      listSourceRows &&
      listSourceRows.length >= 2 &&
      dynamicsKeysFiltered.length > 0 ? (
        <div className="mt-6 space-y-4 border-t border-health-border/60 pt-4">
          <h3 className="text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
            {t(lang, "analyses.dynamics")}
          </h3>
          <div className="flex flex-col gap-4">
            {dynamicsKeysFiltered.map((key) => {
              const series = buildBiomarkerSeries(listSourceRows, key, activeDob);
              if (series.length < 2) return null;
              const norm = getNormForBiomarker(key, ageMonths);
              const unit = unitForBiomarkerKey(listSourceRows, key);
              const insight = trendDeltaInsight(series);

              return (
                <div key={key} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
                  <BiomarkerChart
                    title={key}
                    unit={unit}
                    data={series}
                    normMin={norm?.min ?? null}
                    normMax={norm?.max ?? null}
                  />
                  <p className="text-xs font-medium text-slate-600">
                    <span className="text-health-text-secondary">{t(lang, "dynamics.selectMetric")}: </span>
                    {insight}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!compact ? (
        <p className="mt-4 text-[10px] leading-tight text-health-text-secondary">{t(lang, "analyses.disclaimer")}</p>
      ) : null}
    </section>
  );
}
