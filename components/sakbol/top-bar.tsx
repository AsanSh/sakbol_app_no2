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
};

export function SakbolTopBar({
  variant = "logo",
  title = "Sakbol",
  onBack,
  rightSlot,
  showBell,
  onBell,
  bellUnread,
}: Props) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex items-center justify-between gap-3",
        "border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur-md",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {variant === "back" ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3f4f5] text-[#40484c] transition-colors hover:bg-[#e7e8e9]"
            aria-label="Назад"
          >
            <MaterialIcon name="arrow_back" className="text-[22px]" />
          </button>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#004253] to-[#005b71] text-sm font-extrabold text-white font-manrope">
            S
          </div>
        )}
        <span className="truncate font-manrope text-lg font-extrabold text-[#004253]">{title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {rightSlot}
        {showBell ? (
          <button
            type="button"
            onClick={onBell}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f4f5] text-[#40484c]"
            aria-label="Уведомления"
          >
            <MaterialIcon name="notifications" className="text-[22px]" />
            {bellUnread ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            ) : null}
          </button>
        ) : null}
      </div>
    </header>
  );
}
