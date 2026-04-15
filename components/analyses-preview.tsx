"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { listLabAnalysesForProfile } from "@/app/actions/analyses";
import { createShareToken } from "@/app/actions/share";
import { BISHKEK_CLINICS } from "@/constants/clinics";
import { useLanguage } from "@/context/language-context";
import type { LabAnalysisRow, ProfileSummary } from "@/types/family";
import { useActiveProfile } from "@/context/active-profile-context";
import type { HealthRecordAnalysisPayload } from "@/types/biomarker";
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

type Props = {
  profiles: ProfileSummary[];
  refreshKey?: number;
};

export function AnalysesPreview({ profiles, refreshKey = 0 }: Props) {
  const { lang } = useLanguage();
  const { activeProfileId } = useActiveProfile();
  const [rows, setRows] = useState<LabAnalysisRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeShare, setActiveShare] = useState<{ recordId: string; url: string } | null>(null);

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

  return (
    <section className="rounded-2xl border border-emerald-900/15 bg-white/80 p-4 shadow-sm backdrop-blur">
      <h2 className="text-sm font-semibold text-emerald-950">{t(lang, "analyses.title")}</h2>
      <p className="mt-0.5 text-xs text-emerald-900/65">{t(lang, "analyses.subtitle")}</p>
      <p className="mt-1 text-[10px] leading-snug text-emerald-800/70">{t(lang, "analyses.labsBrands")}</p>

      {showNearLabs ? (
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
        <p className="mt-3 text-sm text-emerald-900/70">{t(lang, "analyses.loading")}</p>
      ) : error ? (
        <p className="mt-3 text-sm text-coral">{error}</p>
      ) : rows?.length === 0 ? (
        <p className="mt-3 text-sm text-emerald-900/70">{t(lang, "analyses.empty")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows?.map((a) => {
            const n = biomarkerCount(a.data);
            const worst = analysisWorstStatus(a.data, activeDob);
            const open = expandedId === a.id;
            const payload =
              a.data && typeof a.data === "object"
                ? (a.data as HealthRecordAnalysisPayload)
                : null;

            return (
              <li
                key={a.id}
                className={cn(
                  "rounded-xl border-2 px-3 py-2 text-sm text-emerald-900 transition-colors",
                  cardTone(worst),
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-2 text-left"
                  onClick={() => setExpandedId(open ? null : a.id)}
                  aria-expanded={open}
                >
                  <span>
                    <span
                      className="font-medium"
                      style={{ borderBottom: `2px solid ${getStatusColorHex(worst)}` }}
                    >
                      {a.title ?? t(lang, "analyses.analysis")}
                    </span>
                    {n != null ? (
                      <span className="ml-2 text-xs text-emerald-800/80">
                        {n} {t(lang, "analyses.indicators")}
                      </span>
                    ) : null}
                    {a.isPrivate ? (
                      <span className="ml-2 rounded bg-amber-500/20 px-1.5 text-[10px] font-medium text-emerald-900">
                        {t(lang, "analyses.private")}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-emerald-900/60">
                      {new Date(a.createdAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "ky-KG")}
                    </span>
                  </span>
                  {open ? (
                    <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />
                  ) : (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />
                  )}
                </button>

                {open && payload?.biomarkers ? (
                  <div className="mt-2 border-t border-emerald-900/10 pt-2">
                    <ul className="space-y-1">
                      {payload.biomarkers.map((b: ParsedBiomarker, idx: number) => {
                        const st = statusForBiomarker(b, activeDob);
                        const nk = normalizeBiomarkerKey(b.biomarker);
                        const catId = nk ? categoryForBiomarkerKey(nk) : "other";
                        return (
                          <li
                            key={`${a.id}-${idx}-${b.biomarker}`}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="text-emerald-950">
                              <span className="block text-[10px] font-medium uppercase tracking-wide text-emerald-800/60">
                                {t(lang, `category.${catId}`)}
                              </span>
                              {b.biomarker}:{" "}
                              <strong>
                                {b.value} {b.unit}
                              </strong>
                            </span>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                              style={{
                                backgroundColor: `${getStatusColorHex(st)}22`,
                                color: getStatusColorHex(st),
                              }}
                            >
                              {t(lang, `status.${st}`)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-900 px-3 py-1.5 text-xs font-medium text-mint"
                        onClick={async () => {
                          const res = await createShareToken(a.id);
                          if (!res.ok) return;
                          const url = `${window.location.origin}/share/${res.token}`;
                          setActiveShare({ recordId: a.id, url });
                        }}
                      >
                        {t(lang, "analyses.shareDoctor")}
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
              </li>
            );
          })}
        </ul>
      )}

      {rows && rows.length >= 2 && dynamicsKeys.length > 0 ? (
        <div className="mt-6 space-y-4 border-t border-emerald-900/10 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">
            {t(lang, "analyses.dynamics")}
          </h3>
          <div className="flex flex-col gap-4">
            {dynamicsKeys.map((key) => {
              const series = buildBiomarkerSeries(rows, key);
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

      <p className="mt-4 text-[10px] leading-tight text-emerald-800/55">{t(lang, "analyses.disclaimer")}</p>
    </section>
  );
}
