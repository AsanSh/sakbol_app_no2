"use client";

import { DsCard } from "@/components/ui/ds-card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

type Props = {
  className?: string;
};

/** Боковая колонка: тариф (юридический дисклеймер — в `DisclaimerCard` на дашборде). */
export function InsightsRail({ className }: Props) {
  const { lang } = useLanguage();

  return (
    <aside
      className={cn(
        "flex min-h-0 w-full flex-col gap-4 overflow-y-auto lg:w-[17.5rem] lg:shrink-0 xl:w-[19rem]",
        className,
      )}
    >
      <DsCard variant="muted" className="p-4 sm:p-5">
        <p className="text-caption font-semibold text-health-text-secondary">{t(lang, "paywall.title")}</p>
        <p className="mt-2 text-sm font-medium leading-snug text-health-text">{t(lang, "paywall.body")}</p>
      </DsCard>
    </aside>
  );
}
