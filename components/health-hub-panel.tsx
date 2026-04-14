"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, HeartPulse, Stethoscope } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { useActiveProfile } from "@/context/active-profile-context";
import { BiologicalSex } from "@prisma/client";
import type { LabAnalysisRow, ProfileSummary } from "@/types/family";
import { t } from "@/lib/i18n";
import {
  ageYearsFromIsoDob,
  biologicalSexToRiskSex,
  buildCardioDemoFromLabs,
  buildFindriscFromLabsAndProfile,
  oncologyScreeningHint,
  overallHealthIndex,
  toneFromCardioPercent,
} from "@/lib/risk-scores";
import {
  analysisWorstStatus,
  worstStatus as mergeMedicalStatus,
  type MedicalStatus,
} from "@/lib/medical-logic";
import { buildAscvdPercentFromLabs, type AscvdSex } from "@/lib/ascvd-pce";
import { MedFormulaBlock } from "@/components/med-formula-block";

type Props = {
  profiles: ProfileSummary[];
  refreshKey?: number;
};

function medicalStatusToScore(s: MedicalStatus): number {
  if (s === "critical") return 2;
  if (s === "warning") return 1;
  return 0;
}

function RiskCard({
  title,
  subtitle,
  valueLabel,
  tone,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  valueLabel: ReactNode;
  tone: "ok" | "warn" | "bad";
  icon: typeof HeartPulse;
}) {
  const border =
    tone === "ok"
      ? "border-emerald-800/25 bg-emerald-900/5"
      : tone === "warn"
        ? "border-amber-500/55 bg-amber-500/10"
        : "border-coral/70 bg-coral/15";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 p-3 shadow-sm ${border}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-mint">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-950">{title}</p>
          <p className="text-[11px] text-emerald-900/70">{subtitle}</p>
          <div className="mt-1.5 text-xs font-medium text-emerald-900">{valueLabel}</div>
        </div>
      </div>
    </motion.div>
  );
}

function HealthGauge({ value }: { value: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  return (
    <div className="relative mx-auto h-28 w-28">
      <svg className="-rotate-90" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e8f5f3" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#00695C"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-emerald-950">{pct}</span>
        <span className="text-[10px] font-medium text-emerald-800/80">/ 100</span>
      </div>
    </div>
  );
}

export function HealthHubPanel({ profiles, refreshKey = 0 }: Props) {
  const { lang } = useLanguage();
  const { activeProfileId } = useActiveProfile();
  const [rows, setRows] = useState<LabAnalysisRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const activeDob = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.id === activeProfileId)?.dateOfBirth ?? null;
  }, [profiles, activeProfileId]);

  const ageYears = useMemo(() => ageYearsFromIsoDob(activeDob), [activeDob]);

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.id === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  const riskSex = useMemo(
    () => biologicalSexToRiskSex(activeProfile?.biologicalSex ?? BiologicalSex.UNKNOWN),
    [activeProfile?.biologicalSex],
  );

  const ascvdSex: AscvdSex = riskSex;

  useEffect(() => {
    if (!activeProfileId) {
      setRows(null);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    void fetch(`/api/analyses?profileId=${encodeURIComponent(activeProfileId)}`, {
      signal: ac.signal,
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ analyses: LabAnalysisRow[] }>;
      })
      .then((d) => setRows(d.analyses))
      .catch(() => setRows(null))
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [activeProfileId, refreshKey]);

  const worstLab = useMemo(() => {
    if (!rows?.length) return "normal" as MedicalStatus;
    let w: MedicalStatus = "normal";
    for (const row of rows) {
      w = mergeMedicalStatus(w, analysisWorstStatus(row.data, activeDob));
    }
    return w;
  }, [rows, activeDob]);

  const findrisc = useMemo(() => {
    if (!rows?.length) return null;
    return buildFindriscFromLabsAndProfile(rows, ageYears, riskSex);
  }, [rows, ageYears, riskSex]);

  const cardio = useMemo(() => {
    if (!rows?.length) return null;
    return buildCardioDemoFromLabs(rows, ageYears, riskSex);
  }, [rows, ageYears, riskSex]);

  const ascvdPct = useMemo(() => {
    if (!rows?.length) return null;
    return buildAscvdPercentFromLabs(rows, ageYears, ascvdSex);
  }, [rows, ageYears, ascvdSex]);

  const onc = useMemo(() => oncologyScreeningHint(ageYears), [ageYears]);

  const healthIndex = useMemo(() => {
    if (!findrisc || !cardio || ascvdPct == null) return null;
    const cardioForIndex = Math.max(cardio.percent, ascvdPct);
    return overallHealthIndex(
      findrisc.points,
      cardioForIndex,
      medicalStatusToScore(worstLab),
    );
  }, [findrisc, cardio, ascvdPct, worstLab]);

  const cardioCombinedTone = useMemo(() => {
    if (!cardio || ascvdPct == null) return "ok" as const;
    return toneFromCardioPercent(Math.max(cardio.percent, ascvdPct));
  }, [cardio, ascvdPct]);

  const oncText =
    onc === "screening_50"
      ? t(lang, "hub.onc.50")
      : onc === "screening_40"
        ? t(lang, "hub.onc.40")
        : t(lang, "hub.onc.info");

  if (!activeProfileId) return null;

  if (loading && rows == null) {
    return (
      <p className="text-sm text-emerald-900/70">{t(lang, "analyses.loading")}</p>
    );
  }

  if (!rows?.length) {
    return (
      <div className="rounded-2xl border border-emerald-900/15 bg-white/80 p-4 text-sm text-emerald-900/80 shadow-sm">
        {t(lang, "hub.noAnalyses")}
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-900/15 bg-white/85 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-emerald-950">{t(lang, "hub.healthScore")}</h2>
          <p className="mt-0.5 max-w-xs text-[11px] text-emerald-900/70">
            {t(lang, "hub.healthScoreHint")}
          </p>
          {activeProfile?.biologicalSex === "UNKNOWN" ? (
            <p className="mt-1 text-[10px] text-amber-800/90">{t(lang, "hub.demoSexNote")}</p>
          ) : null}
        </div>
        {healthIndex != null ? (
          <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            <HealthGauge value={healthIndex} />
          </motion.div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
               {cardio && findrisc && ascvdPct != null ? (
          <>
            <RiskCard
              title={t(lang, "hub.risk.cardio")}
              subtitle={t(lang, "hub.risk.cardioSub")}
              valueLabel={
                <>
                  <span className="block">
                    {t(lang, "hub.risk.euroDemo")}: {cardio.percent}% ·{" "}
                    {t(lang, `hub.tone.${cardio.tone}`)}
                  </span>
                  <span className="mt-1 block text-[11px] text-emerald-900/85">
                    ASCVD (PCE, white): {ascvdPct}% · {t(lang, "hub.risk.percent10y")}
                  </span>
                </>
              }
              tone={cardioCombinedTone}
              icon={HeartPulse}
            />
            <RiskCard
              title={t(lang, "hub.risk.diabetes")}
              subtitle={t(lang, "hub.risk.diabetesSub")}
              valueLabel={`${findrisc.points} ${t(lang, "hub.risk.points")} · ${t(lang, `hub.tone.${findrisc.tone}`)}`}
              tone={findrisc.tone}
              icon={Activity}
            />
            <RiskCard
              title={t(lang, "hub.risk.oncology")}
              subtitle={t(lang, "hub.risk.oncologySub")}
              valueLabel={oncText}
              tone="ok"
              icon={Stethoscope}
            />
          </>
        ) : null}
      </div>

      <MedFormulaBlock className="pt-1" />
    </section>
  );
}
