"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "surface" | "muted";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  interactive?: boolean;
};

export function Card({
  className,
  variant = "surface",
  interactive = false,
  children,
  ...rest
}: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4 shadow-surface sm:p-5",
        variant === "surface" && "bg-health-surface",
        variant === "muted" && "bg-slate-50",
        interactive && "transition-transform duration-200 hover:-translate-y-0.5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
