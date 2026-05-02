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
        "inline-flex min-h-[44px] items-center justify-center rounded-ui-md px-4 font-semibold outline-none transition-[filter,colors] duration-200",
        "focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ui-canvas",
        size === "md" && "text-body",
        size === "sm" && "text-small",
        variant === "primary" &&
          "bg-ui-accent text-ui-accent-foreground hover:brightness-[0.92] active:brightness-[0.88]",
        variant === "secondary" &&
          "bg-ui-surface text-ui-foreground shadow-ui-card ring-1 ring-ui-border hover:bg-ui-border-subtle",
        variant === "ghost" && "bg-transparent text-ui-accent hover:bg-ui-border-subtle",
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
