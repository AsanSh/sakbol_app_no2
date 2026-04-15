"use client";

import { cn } from "@/lib/utils";

type Props = {
  name: string;
  filled?: boolean;
  className?: string;
};

/** Material Symbols Outlined; FILL 0/1 via font variation. */
export function MaterialIcon({ name, filled = false, className }: Props) {
  return (
    <span
      className={cn("material-symbols-outlined select-none leading-none", className)}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
