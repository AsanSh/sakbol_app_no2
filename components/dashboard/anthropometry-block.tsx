"use client";

import { DsCard } from "@/components/ui/ds-card";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Metric = {
  label: string;
  value: string | null;
};

type Props = {
  bloodType: string | null;
  heightCm: number | null;
  weightKg: number | null;
  lastUpdatedLine: string;
  onFillProfile: () => void;
  className?: string;
};

export function AnthropometryBlock({
  bloodType,
  heightCm,
  weightKg,
  lastUpdatedLine,
  onFillProfile,
  className,
}: Props) {
  const { lang } = useLanguage();
  const unspecified = t(lang, "dashboard.anthropometry.notSpecified");
  const specify = t(lang, "dashboard.anthropometry.specify");
  const unitCm = t(lang, "dashboard.anthropometry.unitCm");
  const unitKg = t(lang, "dashboard.anthropometry.unitKg");

  const metrics: Metric[] = [
    {
      label: t(lang, "dashboard.anthropometry.bloodType"),
      value: bloodType?.trim() ? bloodType.trim() : null,
    },
    {
      label: t(lang, "dashboard.anthropometry.height"),
      value: typeof heightCm === "number" ? `${heightCm} ${unitCm}` : null,
    },
    {
      label: t(lang, "dashboard.anthropometry.weight"),
      value: typeof weightKg === "number" ? `${weightKg} ${unitKg}` : null,
    },
  ];

  return (
    <DsCard variant="muted" className={cn(className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-manrope text-h3 font-semibold text-health-text">
          {t(lang, "dashboard.anthropometry.title")}
        </h2>
        <button
          type="button"
          onClick={onFillProfile}
          className="text-caption font-semibold text-health-primary underline decoration-teal-200 underline-offset-4 hover:text-teal-800"
        >
          {t(lang, "dashboard.anthropometry.fillLink")}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex min-h-[44px] flex-col justify-between rounded-xl bg-health-surface px-3 py-3 shadow-sm ring-1 ring-health-border/70"
          >
            <p className="text-caption font-medium text-health-text-secondary">{m.label}</p>
            <p className="mt-1 text-body font-bold tabular-nums text-health-text">
              {m.value ?? unspecified}
            </p>
            <button
              type="button"
              onClick={onFillProfile}
              className="mt-2 self-start text-caption font-semibold text-health-primary hover:underline"
            >
              {specify}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-caption text-health-text-secondary">
        {t(lang, "dashboard.anthropometry.lastUpdated")} {lastUpdatedLine}
      </p>
    </DsCard>
  );
}
