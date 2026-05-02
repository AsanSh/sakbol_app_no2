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
        "rounded-ui-lg border-0 p-4 shadow-ui-card ring-0 sm:p-5",
        variant === "surface" && "bg-ui-surface",
        variant === "muted" && "bg-ui-border-subtle",
        interactive &&
          "transition-[filter,transform] duration-200 hover:-translate-y-px hover:brightness-[0.99] active:brightness-[0.97]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
