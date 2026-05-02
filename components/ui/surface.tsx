"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Отступы по умолчанию как у карточки контента */
  padded?: boolean;
  /** Лёгкая «подъёмная» тень для модалок / попапов */
  elevated?: boolean;
};

/**
 * Контентная поверхность UI Kit: белый фон, скругление ui-lg, без stroke.
 */
export function UiSurface({
  className,
  children,
  padded = true,
  elevated = false,
  ...rest
}: Props) {
  return (
    <div
      className={cn(
        "rounded-ui-lg bg-ui-surface ring-0",
        elevated ? "shadow-ui-float" : "shadow-ui-card",
        padded && "p-4 sm:p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
