"use client";

import { DsCard } from "@/components/ui/ds-card";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/** Боковая колонка дашборда: без демо-оценок и «советов» без источника данных. */
export function InsightsRail({ className }: Props) {
  return (
    <aside
      className={cn(
        "flex min-h-0 w-full flex-col gap-4 overflow-y-auto lg:w-[17.5rem] lg:shrink-0 xl:w-[19rem]",
        className,
      )}
    >
      <DsCard variant="muted" className="p-4 sm:p-5">
        <p className="text-caption font-semibold text-health-text-secondary">Напоминание</p>
        <p className="mt-2 text-sm font-medium leading-snug text-health-text">
          Sakbol не заменяет очный приём врача. При ухудшении самочувствия обратитесь в клинику.
        </p>
      </DsCard>
    </aside>
  );
}
