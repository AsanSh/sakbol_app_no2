"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "@/components/sakbol/material-icon";

type Props = {
  variant?: "logo" | "back";
  title?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
  showBell?: boolean;
  onBell?: () => void;
  bellUnread?: boolean;
  /** Компактная шапка для десктоп-дашборда без лишней высоты */
  dense?: boolean;
};

export function SakbolTopBar({
  variant = "logo",
  title = "Sakbol",
  onBack,
  rightSlot,
  showBell,
  onBell,
  bellUnread,
  dense = false,
}: Props) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex items-center justify-between gap-3",
        "border-b border-slate-100 bg-white/80 backdrop-blur-md",
        dense ? "shrink-0 px-3 py-2" : "px-4 py-3",
      )}
    >
      <div className={cn("flex min-w-0 items-center", dense ? "gap-2" : "gap-3")}>
        {variant === "back" ? (
          <button
            type="button"
            onClick={onBack}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-[#f3f4f5] text-[#40484c] transition-colors hover:bg-[#e7e8e9]",
              dense ? "h-8 w-8" : "h-10 w-10",
            )}
            aria-label="Назад"
          >
            <MaterialIcon name="arrow_back" className={dense ? "text-[18px]" : "text-[22px]"} />
          </button>
        ) : (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#004253] to-[#005b71] font-extrabold text-white font-manrope",
              dense ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
            )}
          >
            S
          </div>
        )}
        <span
          className={cn(
            "truncate font-manrope font-extrabold text-[#004253]",
            dense ? "text-base" : "text-lg",
          )}
        >
          {title}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {rightSlot}
        {showBell ? (
          <button
            type="button"
            onClick={onBell}
            className={cn(
              "relative flex items-center justify-center rounded-full bg-[#f3f4f5] text-[#40484c]",
              dense ? "h-8 w-8" : "h-10 w-10",
            )}
            aria-label="Уведомления"
          >
            <MaterialIcon name="notifications" className={dense ? "text-[18px]" : "text-[22px]"} />
            {bellUnread ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            ) : null}
          </button>
        ) : null}
      </div>
    </header>
  );
}
