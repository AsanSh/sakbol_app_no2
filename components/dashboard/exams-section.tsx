"use client";

import { useState } from "react";
import type { ProfileSummary } from "@/types/family";
import { AnalysesPreview } from "@/components/analyses-preview";
import { DsCard } from "@/components/ui/ds-card";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ExamsMode = "dynamics" | "all";

type Props = {
  profiles: ProfileSummary[];
  refreshKey: number;
  onUploadAnalysis: () => void;
  onOpenAnalyses?: () => void;
  compact?: boolean;
  className?: string;
};

export function ExamsSection({
  profiles,
  refreshKey,
  onUploadAnalysis,
  onOpenAnalyses,
  compact = true,
  className,
}: Props) {
  const { lang } = useLanguage();
  const [mode, setMode] = useState<ExamsMode>("dynamics");

  const tabBase =
    "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-3 text-caption font-semibold transition-all sm:flex-none sm:px-5";
  const isDynamics = mode === "dynamics";

  return (
    <DsCard className={cn("flex min-h-0 flex-1 flex-col overflow-hidden p-0", className)}>
      <div className="shrink-0 space-y-3 border-b border-health-border/60 bg-gradient-to-r from-teal-50/80 via-health-surface to-health-surface px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-manrope text-h3 font-semibold text-health-text">
              {t(lang, "dashboard.exams.title")}
            </h2>
            <p className="mt-0.5 text-caption text-health-text-secondary">
              {t(lang, "dashboard.exams.subtitle")}
            </p>
          </div>
          <div
            className="rounded-xl bg-health-surface/90 p-3 text-caption shadow-sm ring-1 ring-health-border/70"
            role="note"
          >
            <p className="font-semibold text-health-text">{t(lang, "dashboard.exams.legendTitle")}</p>
            <ul className="mt-2 space-y-1 text-health-text-secondary">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                {t(lang, "dashboard.exams.legendGreen")}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                {t(lang, "dashboard.exams.legendYellow")}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-hidden />
                {t(lang, "dashboard.exams.legendRed")}
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full gap-2 rounded-xl bg-slate-100/90 p-1 ring-1 ring-health-border/50 sm:w-auto">
            <button
              type="button"
              className={cn(
                tabBase,
                isDynamics
                  ? "bg-health-surface text-health-primary shadow-sm ring-1 ring-teal-100"
                  : "text-health-text-secondary hover:text-health-text",
              )}
              onClick={() => setMode("dynamics")}
            >
              {t(lang, "dashboard.exams.tabDynamics")}
            </button>
            <button
              type="button"
              className={cn(
                tabBase,
                !isDynamics
                  ? "bg-health-surface text-health-primary shadow-sm ring-1 ring-teal-100"
                  : "text-health-text-secondary hover:text-health-text",
              )}
              onClick={() => setMode("all")}
            >
              {t(lang, "dashboard.exams.tabAll")}
            </button>
          </div>
        </div>
        <p className="text-body text-health-text-secondary">
          {isDynamics ? t(lang, "dashboard.exams.modeDynamics") : t(lang, "dashboard.exams.modeAll")}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-health-bg/50 px-3 pb-3 pt-2 md:px-4">
        {profiles.length > 0 ? (
          <AnalysesPreview
            profiles={profiles}
            refreshKey={refreshKey}
            onRequestUpload={onUploadAnalysis}
            compact={compact}
            onOpenAnalyses={onOpenAnalyses}
            mode={isDynamics ? "trends" : "default"}
            hideHeader
          />
        ) : (
          <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl bg-health-surface/80 p-6 text-center text-body text-health-text-secondary shadow-inner ring-1 ring-health-border/60">
            {t(lang, "dashboard.exams.noProfiles")}
          </div>
        )}
      </div>
    </DsCard>
  );
}
