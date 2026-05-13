"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLDivElement> & {
  /** Лёгкий подъём при наведении (карточки-действия). */
  hoverLift?: boolean;
  /** Секция без жёсткой обводки — только тень и кольцо. */
  variant?: "default" | "muted" | "gradient";
};

export function DsCard({
  className,
  hoverLift,
  variant = "default",
  children,
  ...rest
}: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4 transition-all duration-300 sm:p-6",
        variant === "default" &&
          "bg-ui-surface shadow-ui-card ring-1 ring-ui-border",
        variant === "muted" &&
          "bg-ui-border-subtle shadow-sm ring-1 ring-ui-border/50",
        variant === "gradient" &&
          "bg-gradient-to-br from-health-primary via-health-primary to-teal-800 text-white shadow-lg shadow-teal-900/20 ring-1 ring-white/10",
        hoverLift && "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/[0.08]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
