"use client";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/** Плейсхолдер списка анализов во время загрузки из БД. */
export function AnalysisSkeleton({ className }: Props) {
  return (
    <div
      className={cn("mt-3 space-y-3", className)}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-emerald-900/10 bg-white/60 px-3 py-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-3/5 max-w-[200px] rounded-md bg-emerald-900/15" />
              <div className="h-3 w-24 rounded-md bg-emerald-800/10" />
            </div>
            <div className="h-4 w-4 shrink-0 rounded bg-emerald-800/10" />
          </div>
          <div className="mt-3 space-y-2 border-t border-emerald-900/5 pt-3">
            <div className="h-3 w-full rounded bg-emerald-800/10" />
            <div className="h-3 w-4/5 rounded bg-emerald-800/10" />
            <div className="h-3 w-2/3 rounded bg-emerald-800/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
