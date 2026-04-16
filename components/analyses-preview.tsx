"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, PlusCircle, Stethoscope, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { listLabAnalysesForProfile } from "@/app/actions/analyses";
import { deleteLabAnalysis } from "@/app/actions/health-record";
import { createShareToken } from "@/app/actions/share";
import { BISHKEK_CLINICS } from "@/constants/clinics";
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
  getSmartTip,
  getStatusColorHex,
  ageInMonthsFromDob,
  isProfileChild,
  listBiomarkersWithDynamics,
  normalizeBiomarkerKey,
  statusForBiomarker,
  unitForBiomarkerKey,
  type MedicalStatus,
} from "@/lib/medical-logic";
import type { ParsedBiomarker } from "@/types/biomarker";
import { categoryForBiomarkerKey } from "@/constants/biomarker-categories";
import { downloadLabPdfClient } from "@/lib/download-lab-pdf";

function biomarkerCount(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const d = data as HealthRecordAnalysisPayload;
  return Array.isArray(d.biomarkers) ? d.biomarkers.length : null;
}

function cardTone(worst: MedicalStatus): string {
  if (worst === "critical") {
    return "border-coral/70 bg-coral/15 shadow-sm";
  }
  if (worst === "warning") {
    return "border-amber-500/55 bg-amber-500/10 shadow-sm";
  }
  return "border-emerald-800/25 bg-emerald-900/5";
}

function statusIndicatorPillClass(st: MedicalStatus): string {
  if (st === "critical") return "bg-[#FFEBEE] text-red-900";
  if (st === "warning") return "bg-amber-100 text-amber-950";
  return "bg-emerald-100 text-[#004d40]";
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
};

export function AnalysesPreview({
  profiles,
  refreshKey = 0,
  onRequestUpload,
  compact = false,
  onOpenAnalyses,
}: Props) {
  const { lang } = useLanguage();
  const { activeProfileId } = useActiveProfile();
  const [rows, setRows] = useState<LabAnalysisRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeShare, setActiveShare] = useState<{ recordId: string; url: string } | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<{ id: string; msg: string } | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const activeDob = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.id === activeProfileId)?.dateOfBirth ?? null;
  }, [profiles, activeProfileId]);

  const ageMonths = useMemo(() => ageInMonthsFromDob(activeDob), [activeDob]);
  const childProfile = useMemo(() => isProfileChild(activeDob), [activeDob]);

  const showNearLabs = useMemo(() => {
    if (!rows?.length) return false;
    return rows.some((a) => {
      const w = analysisWorstStatus(a.data, activeDob);
      return w === "warning" || w === "critical";
    });
  }, [rows, activeDob]);

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

  const dynamicsKeys = useMemo(
    () => (rows?.length ? listBiomarkersWithDynamics(rows, 2) : []),
    [rows],
  );

  if (!activeProfileId) return null;

  const rowsForUi = compact ? rows?.slice(0, 2) : rows;

  return (
    <section
      className={cn(
        "rounded-2xl border border-emerald-200/90 bg-white shadow-md shadow-emerald-900/[0.06] ring-1 ring-emerald-100/80 backdrop-blur-sm",
        compact ? "flex h-full min-h-0 flex-col overflow-hidden p-2" : "p-4",
      )}
    >
      <h2
        className={cn(
          "border-coral font-semibold text-emerald-950",
          compact ? "border-l-2 pl-2 text-xs" : "border-l-4 pl-3 text-sm",
        )}
      >
        {t(lang, "analyses.title")}
      </h2>
      {!compact ? (
        <>
          <p className="mt-0.5 text-xs text-emerald-700/75">{t(lang, "analyses.subtitle")}</p>
          <p className="mt-1 text-[10px] leading-snug text-emerald-600/70">{t(lang, "analyses.labsBrands")}</p>
        </>
      ) : (
        <p className="mt-0.5 truncate text-[10px] text-emerald-700/70">{t(lang, "analyses.subtitle")}</p>
      )}

      {!compact && showNearLabs ? (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-emerald-950">{t(lang, "analyses.nearLabs")}</p>
          <p className="mt-0.5 text-[11px] text-emerald-900/75">{t(lang, "analyses.nearLabsHint")}</p>
          <ul className="mt-2 space-y-2">
            {BISHKEK_CLINICS.map((c) => (
              <li
                key={c.name}
                className="rounded-lg border border-emerald-900/10 bg-white/90 px-2.5 py-2 text-xs text-emerald-950"
              >
                <span className="font-medium">{c.name}</span>
                <span className="mt-0.5 block text-emerald-800/80">{c.address}</span>
                <a className="mt-0.5 inline-block text-emerald-900 underline" href={`tel:${c.phone.replace(/\s/g, "")}`}>
                  {c.phone}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <AnalysisSkeleton className={compact ? "mt-2" : "mt-3"} />
      ) : error ? (
        <p className={cn("text-coral", compact ? "mt-2 text-xs" : "mt-3 text-sm")}>{error}</p>
      ) : rows?.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center text-center",
            compact ? "mt-2 px-2 py-4" : "mt-6 px-4 py-10",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl bg-emerald-100/90 shadow-inner",
              compact ? "h-10 w-10" : "h-16 w-16",
            )}
          >
            <Stethoscope
              className="text-emerald-300"
              size={compact ? 22 : 36}
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
          <h3
            className={cn(
              "font-manrope font-semibold text-emerald-950",
              compact ? "mt-2 text-xs" : "mt-4 text-base",
            )}
          >
            {t(lang, "analyses.emptyPrimary")}
          </h3>
          <p
            className={cn(
              "text-emerald-600/70",
              compact ? "mt-1 max-w-xs text-[10px]" : "mt-2 max-w-sm text-sm",
            )}
          >
            {t(lang, "analyses.emptySecondary")}
          </p>
          {onRequestUpload ? (
            <button
              type="button"
              onClick={onRequestUpload}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl bg-sakbol-cta font-semibold text-white shadow-cta-coral transition-[filter] hover:brightness-[1.04] active:brightness-[0.98]",
                compact ? "mt-2 px-3 py-1.5 text-[11px]" : "mt-5 px-6 py-3 text-sm",
              )}
            >
              <PlusCircle size={compact ? 14 : 16} strokeWidth={2} aria-hidden />
              {t(lang, "tests.uploadBig")}
            </button>
          ) : null}
        </div>
      ) : (
        <ul
          className={cn(
            "grid gap-2",
            compact
              ? "mt-2 min-h-0 flex-1 grid-cols-1 overflow-hidden"
              : "mt-3 grid-cols-1 gap-3 sm:grid-cols-2",
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
                  "rounded-2xl border-2 text-emerald-900 shadow-sm transition-shadow hover:shadow-md",
                  compact ? "px-2.5 py-2 text-xs" : "px-4 py-3 text-sm",
                  cardTone(worst),
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
                        className="font-semibold text-slate-900"
                        style={{ borderBottom: `2px solid ${getStatusColorHex(worst)}` }}
                      >
                        {a.title ?? t(lang, "analyses.analysis")}
                      </span>
                      {n != null ? (
                        <span className="ml-2 text-xs text-slate-500">
                          {n} {t(lang, "analyses.indicators")}
                        </span>
                      ) : null}
                      {a.isPrivate ? (
                        <span className="ml-2 rounded bg-amber-500/20 px-1.5 text-[10px] font-medium text-emerald-900">
                          {t(lang, "analyses.private")}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-emerald-600/70">
                        {new Date(a.createdAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "ky-KG")}
                      </span>
                    </span>
                    {!compact ? (
                      open ? (
                        <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />
                      ) : (
                        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />
                      )
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={deleteBusyId === a.id}
                    title={t(lang, "analyses.delete")}
                    aria-label={t(lang, "analyses.delete")}
                    className={cn(
                      "flex min-w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-red-400/90 bg-white px-2 py-1.5 text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50 sm:min-w-[4.5rem] sm:flex-row sm:gap-1 sm:px-2.5",
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
                  <div className="mt-2 border-t border-emerald-900/10 pt-3">
                    {payload?.biomarkers && payload.biomarkers.length > 0 ? (
                      <>
                        {(() => {
                          const ranked = [...payload.biomarkers].sort((x, y) => {
                            const rank: Record<MedicalStatus, number> = {
                              critical: 0,
                              warning: 1,
                              normal: 2,
                            };
                            return rank[statusForBiomarker(x, activeDob)] - rank[statusForBiomarker(y, activeDob)];
                          });
                          const critical = ranked.filter((b) => statusForBiomarker(b, activeDob) === "critical");
                          const warning = ranked.filter((b) => statusForBiomarker(b, activeDob) === "warning");
                          const normal = ranked.filter((b) => statusForBiomarker(b, activeDob) === "normal");

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
                                    ? "border border-coral/30 bg-[#fff4f4] text-red-900"
                                    : warning.length > 0
                                      ? "border border-amber-400/40 bg-amber-50 text-amber-900"
                                      : "border border-emerald-800/15 bg-emerald-50/60 text-emerald-900",
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
                    ) : (
                      <p className="py-2 text-xs text-slate-500">
                        Показатели в этой записи не найдены или ещё обрабатываются.
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-sakbol-cta px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-coral/25 transition-[filter] hover:brightness-[1.05]"
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
                        className="rounded-lg border border-emerald-800/35 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 disabled:opacity-50"
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
                      {worst === "critical" ? (
                        <a
                          href={BISHKEK_CLINICS[0]?.bookingUrl ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-coral/60 bg-coral/10 px-3 py-1.5 text-xs font-medium text-emerald-950"
                        >
                          {t(lang, "analyses.findClinic")}
                        </a>
                      ) : null}
                    </div>

                    {!compact ? (
                      <button
                        type="button"
                        disabled={deleteBusyId === a.id}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-400 bg-red-50/90 py-2.5 text-sm font-semibold text-red-800 shadow-sm transition-colors hover:bg-red-100 disabled:opacity-50"
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
                      <div className="mt-3 rounded-xl border border-emerald-900/20 bg-white p-3">
                        <p className="text-xs font-semibold text-emerald-900">{t(lang, "analyses.qrTitle")}</p>
                        <p className="text-[11px] text-emerald-800/80">{t(lang, "analyses.qrHint")}</p>
                        <div className="mt-2 flex justify-center rounded-lg bg-white p-2">
                          <QRCodeSVG value={activeShare.url} size={168} level="M" includeMargin />
                        </div>
                        <a
                          className="mt-2 block break-all text-xs text-emerald-900 underline"
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
      )}

      {compact && rows && rows.length > 2 && onOpenAnalyses ? (
        <button
          type="button"
          onClick={onOpenAnalyses}
          className="mt-1.5 shrink-0 rounded-lg border border-emerald-800/25 bg-emerald-50/80 py-1.5 text-center text-[11px] font-medium text-emerald-900 transition-colors hover:bg-emerald-100/90"
        >
          {t(lang, "analyses.viewAll")}
          <span className="text-emerald-700/80"> · +{rows.length - 2}</span>
        </button>
      ) : null}

      {!compact && rows && rows.length >= 2 && dynamicsKeys.length > 0 ? (
        <div className="mt-6 space-y-4 border-t border-emerald-900/10 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">
            {t(lang, "analyses.dynamics")}
          </h3>
          <div className="flex flex-col gap-4">
            {dynamicsKeys.map((key) => {
              const series = buildBiomarkerSeries(rows, key, activeDob);
              if (series.length < 2) return null;
              const norm = getNormForBiomarker(key, ageMonths);
              const unit = unitForBiomarkerKey(rows, key);
              const last = series[series.length - 1];
              const lastRow = rows.find((r) => r.id === last.recordId);
              let lastBm: ParsedBiomarker | undefined;
              if (lastRow?.data && typeof lastRow.data === "object") {
                const d = lastRow.data as HealthRecordAnalysisPayload;
                lastBm = d.biomarkers?.find(
                  (b) => normalizeBiomarkerKey(b.biomarker) === key,
                );
              }
              const st = lastBm ? statusForBiomarker(lastBm, activeDob) : "normal";
              const tip = lastBm ? getSmartTip(lastBm.biomarker, st, childProfile) : null;

              return (
                <div key={key} className="space-y-2">
                  <BiomarkerChart
                    title={key}
                    unit={unit}
                    data={series}
                    normMin={norm?.min ?? null}
                    normMax={norm?.max ?? null}
                  />
                  {tip ? (
                    <div className="rounded-xl border border-emerald-800/20 bg-mint/25 px-3 py-2 text-xs leading-snug text-emerald-950">
                      <span className="font-semibold text-emerald-900">{t(lang, "analyses.aiInsight")} </span>
                      {tip}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!compact ? (
        <p className="mt-4 text-[10px] leading-tight text-emerald-800/55">{t(lang, "analyses.disclaimer")}</p>
      ) : null}
    </section>
  );
}
