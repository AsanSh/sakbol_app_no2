"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  description?: ReactNode;
};

export function Section({ className, title, description, children, ...rest }: Props) {
  return (
    <section className={cn("space-y-4", className)} {...rest}>
      {title ? (
        <header className="space-y-1">
          <h2 className="text-h3 font-semibold text-health-text">{title}</h2>
          {description ? (
            <p className="text-small text-health-text-secondary">{description}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
