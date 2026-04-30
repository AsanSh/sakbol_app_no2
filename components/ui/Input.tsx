"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...rest }: Props) {
  return (
    <input
      className={cn(
        "min-h-[44px] w-full rounded-xl bg-health-surface px-3 text-body text-health-text shadow-sm ring-1 ring-health-border",
        "placeholder:text-health-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-health-secondary",
        className,
      )}
      {...rest}
    />
  );
}
