"use client";

import { Bell, Search } from "lucide-react";
import { ProfileAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
  onNotifications?: () => void;
  bellUnread?: boolean;
  className?: string;
};

export function DesktopDashboardHeader({
  displayName,
  avatarUrl,
  onNotifications,
  bellUnread,
  className,
}: Props) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex shrink-0 items-center gap-4 border-b border-health-border/70 bg-health-bg/85 px-2 py-3 backdrop-blur-md md:px-0 md:py-4",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-health-text-secondary"
          aria-hidden
        />
        <input
          type="search"
          readOnly
          placeholder="Поиск по анализам и маркерам…"
          className="w-full cursor-default rounded-xl border-0 bg-health-surface py-2.5 pl-10 pr-4 text-body text-health-text shadow-sm ring-1 ring-health-border/80 placeholder:text-health-text-secondary/70"
          aria-label="Поиск (скоро)"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onNotifications}
          className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-health-surface text-health-text shadow-sm ring-1 ring-health-border/80 transition-all duration-300 hover:shadow-md"
          aria-label="Уведомления"
        >
          <Bell className="h-5 w-5" strokeWidth={2} />
          {bellUnread ? (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-health-danger ring-2 ring-white" />
          ) : null}
        </button>
        <div className="flex items-center gap-2 rounded-xl bg-health-surface py-1.5 pl-1.5 pr-3 shadow-sm ring-1 ring-health-border/80">
          <ProfileAvatar src={avatarUrl ?? null} name={displayName} size={36} />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-caption font-semibold text-health-text">{displayName}</p>
            <p className="truncate text-[10px] font-medium text-health-text-secondary">Аккаунт</p>
          </div>
        </div>
      </div>
    </header>
  );
}
