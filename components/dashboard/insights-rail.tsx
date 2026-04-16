"use client";

import { Droplets, Moon, Sun } from "lucide-react";
import { DsCard } from "@/components/ui/ds-card";
import { cn } from "@/lib/utils";

type Insight = {
  title: string;
  body: string;
  icon: typeof Droplets;
  tone: "teal" | "amber" | "emerald";
};

const DEFAULT_INSIGHTS: Insight[] = [
  {
    title: "Гидратация",
    body: "Добавьте 1–2 стакана воды к текущему режиму — мягкая цель на неделю.",
    icon: Droplets,
    tone: "teal",
  },
  {
    title: "Сон",
    body: "Рекомендуем +30 минут ко сну для восстановления (по общим ориентирам).",
    icon: Moon,
    tone: "amber",
  },
  {
    title: "Витамин D",
    body: "Повторный анализ через 8–12 недель после консультации с врачом.",
    icon: Sun,
    tone: "emerald",
  },
];

const toneIcon: Record<Insight["tone"], string> = {
  teal: "bg-teal-50 text-health-primary ring-teal-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-100",
};

type Props = {
  className?: string;
  familyAvgScore?: number | null;
};

export function InsightsRail({ className, familyAvgScore }: Props) {
  return (
    <aside
      className={cn(
        "flex min-h-0 w-full flex-col gap-4 overflow-y-auto lg:w-[17.5rem] lg:shrink-0 xl:w-[19rem]",
        className,
      )}
    >
      <DsCard className="p-4 sm:p-5">
        <p className="text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
          Сводка семьи
        </p>
        <p className="mt-2 font-manrope text-h3 font-semibold text-health-text">
          {familyAvgScore != null ? `${familyAvgScore} баллов` : "Добавьте участников"}
        </p>
        <p className="mt-1 text-caption leading-relaxed text-health-text-secondary">
          Средний Health Score по активным профилям. Показатель демонстрационный до полной аналитики.
        </p>
      </DsCard>

      <div>
        <p className="mb-2 px-0.5 text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
          Рекомендации
        </p>
        <ul className="space-y-3">
          {DEFAULT_INSIGHTS.map((item) => (
            <li key={item.title}>
              <DsCard hoverLift className="p-4">
                <div className="flex gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
                      toneIcon[item.tone],
                    )}
                  >
                    <item.icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-health-text">{item.title}</p>
                    <p className="mt-1 text-caption leading-relaxed text-health-text-secondary">
                      {item.body}
                    </p>
                  </div>
                </div>
              </DsCard>
            </li>
          ))}
        </ul>
      </div>

      <DsCard variant="muted" className="p-4">
        <p className="text-caption font-semibold text-health-text-secondary">Напоминание</p>
        <p className="mt-2 text-sm font-medium leading-snug text-health-text">
          Sakbol не заменяет очный приём врача. При ухудшении самочувствия обратитесь в клинику.
        </p>
      </DsCard>
    </aside>
  );
}
