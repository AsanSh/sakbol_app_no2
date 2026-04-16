"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "positive" | "warning" | "danger";

const toneRing: Record<Tone, string> = {
  default: "bg-slate-50 text-health-text ring-slate-200/80",
  positive: "bg-emerald-50 text-emerald-900 ring-emerald-200/70",
  warning: "bg-amber-50 text-amber-950 ring-amber-200/70",
  danger: "bg-red-50 text-red-900 ring-red-200/70",
};

type Props = {
  icon?: ReactNode;
  label: string;
  value: string;
  tone?: Tone;
  className?: string;
};

export function StatChip({ icon, label, value, tone = "default", className }: Props) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2 ring-1 transition-colors duration-300",
        toneRing[tone],
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-caption font-medium text-health-text-secondary">
        {icon ? <span className="shrink-0 opacity-80">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>
      <p className="truncate text-sm font-semibold tabular-nums text-health-text">{value}</p>
    </div>
  );
}
