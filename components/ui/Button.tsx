"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  fullWidth = false,
  children,
  ...rest
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 font-semibold outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-health-secondary focus-visible:ring-offset-2",
        size === "md" && "text-body",
        size === "sm" && "text-small",
        variant === "primary" && "bg-health-primary text-white hover:bg-teal-700",
        variant === "secondary" &&
          "bg-health-surface text-health-primary shadow-sm ring-1 ring-health-border hover:bg-slate-50",
        variant === "ghost" && "bg-transparent text-health-primary hover:bg-teal-50",
        fullWidth && "w-full",
        rest.disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
