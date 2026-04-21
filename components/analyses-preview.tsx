"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import useSWRInfinite from "swr/infinite";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  PlusCircle,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { listLabAnalysesForProfile } from "@/app/actions/analyses";
import { deleteHealthDocument } from "@/app/actions/health-document";
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
import { archivePrimaryDateLabel, ARCHIVE_CATEGORY_RU } from "@/lib/archive-display-dates";
import { effectiveAnalysisTimeMs } from "@/lib/lab-analysis-dates";

type HealthDocRow = {
  id: string;
  title: string;
  fileUrl: string;
  category: string;
  documentDate: string | null;
  createdAt: string;
  mimeType: string | null;
};

type UnifiedItem =
  | { kind: "lab"; sortMs: number; lab: LabAnalysisRow }
  | { kind: "doc"; sortMs: number; doc: HealthDocRow };

type DocumentsPage = {
  documents: HealthDocRow[];
  hasMore?: boolean;
  nextCursor?: string | null;
};

const documentsFetcher = async (url: string): Promise<DocumentsPage> => {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("documents_fetch_failed");
  return (await r.json()) as DocumentsPage;
};

const DocumentSkeleton = () => (
  <div className="flex items-center gap-3 rounded-xl bg-white p-3 animate-pulse">
    <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-gray-200" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-1/4 rounded bg-gray-200" />
      <div className="h-4 w-3/4 rounded bg-gray-200" />
      <div className="h-3 w-1/2 rounded bg-gray-200" />
    </div>
    <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gray-100" />
  </div>
);

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
  const [deleteDocBusyId, setDeleteDocBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshTick, setAutoRefreshTick] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const lastLabPidRef = useRef<string | null>(null);
  const labReqIdRef = useRef(0);

  const docsApiUrl =
    activeProfileId && !isTrends ? `/api/documents?profileId=${encodeURIComponent(activeProfileId)}&take=20` : null;
  const {
    data: docsPages,
    isLoading: docsLoading,
    mutate: mutateDocs,
    size: docsSize,
    setSize: setDocsSize,
  } = useSWRInfinite<DocumentsPage>(
    (pageIndex, previousPageData) => {
      if (!docsApiUrl) return null;
      if (pageIndex === 0) return docsApiUrl;
      if (!previousPageData?.hasMore || !previousPageData?.nextCursor) return null;
      return `${docsApiUrl}&cursor=${encodeURIComponent(previousPageData.nextCursor)}`;
    },
    documentsFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
      keepPreviousData: true,
    },
  );
  const docRows = useMemo(
    () => (docsPages ? docsPages.flatMap((p) => (Array.isArray(p.documents) ? p.documents : [])) : null),
    [docsPages],
  );
  const docsHasMore = docsPages ? Boolean(docsPages[docsPages.length - 1]?.hasMore) : false;
  const docsLoadingMore = docsLoading || (docsSize > 0 && !docsPages?.[docsSize - 1]);

  const activeDob = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.id === activeProfileId)?.dateOfBirth ?? null;
  }, [profiles, activeProfileId]);

  const ageMonths = useMemo(() => ageInMonthsFromDob(activeDob), [activeDob]);

  useEffect(() => {
    if (!activeProfileId) return;
    const refresh = () => setAutoRefreshTick((v) => v + 1);
    const intervalId = window.setInterval(refresh, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [activeProfileId]);

  useEffect(() => {
    if (!activeProfileId) {
      setRows(null);
      lastLabPidRef.current = null;
      return;
    }
    const pidChanged = lastLabPidRef.current !== activeProfileId;
    lastLabPidRef.current = activeProfileId;
    if (pidChanged) {
      setRows(null);
    }

    const reqId = ++labReqIdRef.current;
    const hadRows = !pidChanged && rowsRef.current !== null;
    if (!hadRows) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    void listLabAnalysesForProfile(activeProfileId)
      .then((d) => {
        if (reqId !== labReqIdRef.current) return;
        if (!d.ok) {
          throw new Error(d.error);
        }
        startTransition(() => {
          setRows(d.analyses);
          setLastSyncedAt(Date.now());
        });
      })
      .catch((e: unknown) => {
        if (reqId !== labReqIdRef.current) return;
        setError(e instanceof Error ? e.message : t(lang, "analyses.errorLoad"));
        setRows(null);
      })
      .finally(() => {
        if (reqId === labReqIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      });
  }, [activeProfileId, refreshKey, autoRefreshTick, lang]);

  useEffect(() => {
    if (!docsApiUrl) return;
    void mutateDocs();
  }, [docsApiUrl, refreshKey, autoRefreshTick, mutateDocs]);

  useEffect(() => {
    if (!docsLoading && docsPages) {
      setLastSyncedAt(Date.now());
    }
  }, [docsLoading, docsPages]);

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

  const unifiedForUi = useMemo((): UnifiedItem[] | null => {
    if (isTrends) return null;
    const labs = filteredRows ?? [];
    const docs = docRows ?? [];
    const items: UnifiedItem[] = [
      ...labs.map((lab) => ({
        kind: "lab" as const,
        sortMs: effectiveAnalysisTimeMs(lab),
        lab,
      })),
      ...docs.map((doc) => ({
        kind: "doc" as const,
        sortMs: doc.documentDate ? Date.parse(doc.documentDate) : Date.parse(doc.createdAt),
        doc,
      })),
    ];
    items.sort((a, b) => b.sortMs - a.sortMs);
    return compact ? items.slice(0, 2) : items;
  }, [filteredRows, docRows, isTrends, compact]);

  if (!activeProfileId) return null;

  /** Полный скелетон только при первом получении данных, не при фоновом обновлении после загрузки файла. */
  const showBlockingSkeleton = (rows === null && loading) || (!isTrends && docRows === null && docsLoading);

  const listIdle = !loading && (isTrends || !docsLoading);
  const archiveTotalCount =
    (listSourceRows?.length ?? 0) + (isTrends ? 0 : (docRows?.length ?? 0));

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

  const syncedLabel = (() => {
    if (!lastSyncedAt) return null;
    const diffMs = Date.now() - lastSyncedAt;
    if (diffMs < 10_000) {
      return lang === "ru" ? "Синхронизировано только что" : "Азыр эле жаңыртылды";
    }
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) {
      return lang === "ru"
        ? `Синхронизировано ${sec} сек назад`
        : `${sec} сек мурун жаңыртылды`;
    }
    const min = Math.floor(sec / 60);
    if (min < 60) {
      return lang === "ru"
        ? `Синхронизировано ${min} мин назад`
        : `${min} мин мурун жаңыртылды`;
    }
    const h = Math.floor(min / 60);
    return lang === "ru"
      ? `Синхронизировано ${h} ч назад`
      : `${h} саат мурун жаңыртылды`;
  })();

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
          <div className="flex items-center gap-2">
            <h2
              className={cn(
                "font-manrope font-semibold text-health-text",
                compact ? "text-xs" : "text-h3",
              )}
            >
              {isTrends ? t(lang, "trends.pageTitle") : t(lang, "analyses.title")}
            </h2>
            {refreshing ? (
              <Loader2
                className={cn("shrink-0 animate-spin text-health-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")}
                aria-hidden
              />
            ) : null}
          </div>
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

      {!isTrends && syncedLabel ? (
        <p className={cn("text-[10px] text-health-text-secondary", hideHeader ? "mt-0.5" : "mt-1")}>
          {syncedLabel}
        </p>
      ) : null}

      {isTrends && !compact ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-md shadow-slate-900/[0.04] ring-1 ring-health-border/80">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    "min-h-[36px] shrink-0 rounded-lg px-3 text-[12px] font-semibold transition-colors",
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

      {showBlockingSkeleton ? (
        <AnalysisSkeleton className={compact ? "mt-2" : "mt-3"} />
      ) : !isTrends && docsLoading && docRows !== null && docRows.length > 0 ? (
        <div className={cn("space-y-2", compact ? "mt-2" : "mt-3")}>
          {[1, 2, 3].map((i) => (
            <DocumentSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <p className={cn("text-health-danger", compact ? "mt-2 text-xs" : "mt-3 text-sm")}>{error}</p>
      ) : listIdle &&
        (isTrends
          ? (rows?.length ?? 0) === 0
          : (rows?.length ?? 0) === 0 && docRows !== null && docRows.length === 0) ? (
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
          {!isTrends &&
          unifiedForUi &&
          unifiedForUi.length === 0 &&
          (listSourceRows?.length ?? 0) > 0 &&
          statusFilter !== "all" ? (
            <div
              className={cn(
                "rounded-xl bg-slate-50/90 text-center text-health-text-secondary ring-1 ring-health-border/70",
                compact ? "mt-2 px-3 py-6 text-xs" : "mt-4 px-4 py-10 text-body",
              )}
            >
              {t(lang, "analyses.filterEmpty")}
            </div>
          ) : null}
          {!isTrends && unifiedForUi && unifiedForUi.length > 0 ? (
            <>
            <ul
              className={cn(
                "grid gap-2",
                compact
                  ? "mt-2 min-h-0 flex-1 grid-cols-1 overflow-hidden"
                  : "mt-4 grid-cols-1 gap-3 sm:grid-cols-2",
              )}
            >
          {unifiedForUi.map((item, idx) => {
            if (item.kind === "doc") {
              const d = item.doc;
              const loc = lang === "ru" ? "ru-RU" : "ky-KG";
              const { primary, hint } = archivePrimaryDateLabel(d.documentDate, d.createdAt, loc);
              return (
                <motion.li
                  key={`doc-${d.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: idx * 0.05, ease: "easeOut" }}
                  className={cn(
                    "rounded-2xl bg-white text-health-text shadow-sm ring-1 ring-slate-200/90 transition-all duration-300 hover:shadow-lg",
                    compact ? "px-2.5 py-2 text-xs" : "px-4 py-3 text-sm",
                  )}
                >
                  <div className="flex items-stretch gap-2">
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-[3rem] min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-health-primary">
                        <FileText className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-health-text-secondary">
                          {ARCHIVE_CATEGORY_RU[d.category] ?? d.category}
                        </span>
                        <span className="font-semibold text-health-text">{d.title}</span>
                        <span className="mt-1 block text-xs text-health-text-secondary">
                          {primary}
                          {hint ? (
                            <span className="mt-0.5 block text-[11px] text-health-text-secondary/85">
                              {hint}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </a>
                    <button
                      type="button"
                      disabled={deleteDocBusyId === d.id}
                      title={t(lang, "analyses.delete")}
                      aria-label={t(lang, "analyses.delete")}
                      className={cn(
                        "flex min-w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-red-50/90 px-2 py-1.5 text-red-800 ring-1 ring-red-200/80 shadow-sm transition-colors hover:bg-red-100/90 disabled:opacity-50 sm:min-w-[4.5rem] sm:flex-row sm:gap-1 sm:px-2.5",
                        compact && "min-w-10 px-1.5 py-1",
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!window.confirm(t(lang, "analyses.deleteDocConfirm"))) return;
                        setDeleteDocBusyId(d.id);
                        void deleteHealthDocument(d.id)
                          .then((r) => {
                            if (!r.ok) {
                              setError(r.error);
                              return;
                            }
                            void mutateDocs((prev) => {
                              if (!prev) return prev;
                              return prev.map((page) => ({
                                ...page,
                                documents: page.documents.filter((x) => x.id !== d.id),
                              }));
                            }, false);
                          })
                          .finally(() => setDeleteDocBusyId(null));
                      }}
                    >
                      {deleteDocBusyId === d.id ? (
                        <Loader2 className={cn("animate-spin", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                      ) : (
                        <Trash2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </motion.li>
              );
            }

            const a = item.lab;
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
            {!compact && docsHasMore ? (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => void setDocsSize((s) => s + 1)}
                  disabled={docsLoadingMore}
                  className="rounded-xl border border-health-border bg-white px-4 py-2 text-sm font-semibold text-health-text shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {docsLoadingMore ? "Загрузка..." : "Загрузить еще"}
                </button>
              </div>
            ) : null}
            </>
          ) : null}
        </>
      )}

      {compact && archiveTotalCount > 2 && onOpenAnalyses ? (
        <button
          type="button"
          onClick={onOpenAnalyses}
          className="mt-1.5 shrink-0 rounded-xl bg-teal-50 py-2 text-center text-caption font-semibold text-health-primary ring-1 ring-teal-100 transition-colors hover:bg-teal-100/80"
        >
          {t(lang, "analyses.viewAll")}
          <span className="text-health-text-secondary"> · +{archiveTotalCount - 2}</span>
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
