"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  score: number;
  max?: number;
  size?: number;
  stroke?: number;
  className?: string;
  /** Подпись под кольцом (например «Отличное состояние»). */
  label?: string;
};

export function HealthScoreRing({
  score,
  max = 100,
  size = 132,
  stroke = 2.75,
  className,
  label,
}: Props) {
  const gid = useId().replace(/:/g, "");
  const pct = Math.min(1, Math.max(0, score / max));

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 36 36" className="-rotate-90">
          <defs>
            <linearGradient id={`hrg-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#0F766E" />
            </linearGradient>
          </defs>
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={stroke}
          />
          <motion.path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={`url(#hrg-${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: pct }}
            transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
          <span className="font-manrope text-3xl font-bold tabular-nums tracking-tight text-health-text">
            {Math.round(score)}
          </span>
          <span className="mt-0.5 text-xs font-medium text-health-text-secondary">/{max}</span>
        </div>
      </div>
      {label ? (
        <p className="mt-2 max-w-[12rem] text-center text-caption font-medium text-health-text-secondary">
          {label}
        </p>
      ) : null}
    </div>
  );
}
