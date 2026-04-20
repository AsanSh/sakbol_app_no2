"use client";

import { MaterialIcon } from "@/components/sakbol/material-icon";
import { DsCard } from "@/components/ui/ds-card";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  /** Имя активного профиля */
  displayName: string;
  /** Часть приветствия без имени, напр. «Добрый вечер» */
  greetPrefix: string;
  onUpload: () => void;
  onOpenDynamics: () => void;
  onAskAI: () => void;
  onOpenFamily: () => void;
  className?: string;
};

export function GreetingCard({
  displayName,
  greetPrefix,
  onUpload,
  onOpenDynamics,
  onAskAI,
  onOpenFamily,
  className,
}: Props) {
  const { lang } = useLanguage();
  const ctaBase =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-caption font-semibold transition-all duration-300";
  const ctaPrimary = `${ctaBase} bg-health-primary text-white shadow-md shadow-teal-900/15 hover:bg-teal-700`;
  const ctaSecondary = `${ctaBase} bg-health-surface text-health-text shadow-sm ring-1 ring-health-border hover:shadow-md`;

  return (
    <DsCard className={cn("relative overflow-hidden", className)}>
      <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl" />
      <div className="relative space-y-3">
        <p className="text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
          {t(lang, "dashboard.activeProfileLabel")}
        </p>
        <h1 className="font-manrope text-display font-bold tracking-tight text-health-text md:text-[2.25rem]">
          {greetPrefix}, {displayName}
        </h1>
        <p className="max-w-xl text-body leading-relaxed text-health-text-secondary">
          {t(lang, "dashboard.greetingSubtitle")}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className={ctaPrimary} onClick={onUpload}>
            <MaterialIcon name="cloud_upload" className="text-[18px]" />
            {t(lang, "dashboard.upload")}
          </button>
          <button type="button" className={ctaSecondary} onClick={onOpenDynamics}>
            <MaterialIcon name="trending_up" className="text-[18px]" />
            {t(lang, "dashboard.viewDynamics")}
          </button>
          <button type="button" className={ctaSecondary} onClick={onAskAI}>
            <MaterialIcon name="auto_awesome" className="text-[18px]" />
            {t(lang, "dashboard.askAIDoctor")}
          </button>
          <button type="button" className={ctaSecondary} onClick={onOpenFamily}>
            <MaterialIcon name="group_add" className="text-[18px]" />
            {t(lang, "dashboard.openFamily")}
          </button>
        </div>
      </div>
    </DsCard>
  );
}
