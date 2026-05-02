"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function UiSectionTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) {
  return (
    <h2
      className={cn(
        "font-manrope text-h3 font-semibold tracking-tight text-ui-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </h2>
  );
}

export function UiLead({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-body leading-relaxed text-ui-muted", className)} {...rest}>
      {children}
    </p>
  );
}
