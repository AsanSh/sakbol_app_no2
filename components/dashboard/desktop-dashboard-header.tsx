"use client";

import { Bell, Search } from "lucide-react";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
  onNotifications?: () => void;
  onOpenAccount: () => void;
  bellUnread?: boolean;
  className?: string;
};

export function DesktopDashboardHeader({
  displayName,
  avatarUrl,
  onNotifications,
  onOpenAccount,
  bellUnread,
  className,
}: Props) {
  const { lang } = useLanguage();

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-health-border/70 bg-health-bg/85 px-2 py-3 backdrop-blur-md md:gap-4 md:px-0 md:py-4",
        className,
      )}
    >
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-health-surface text-health-text shadow-sm ring-1 ring-health-border/80 transition-all hover:shadow-md"
        title={t(lang, "header.searchSoon")}
        aria-label={t(lang, "header.searchSoon")}
      >
        <Search className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>
      <div className="min-w-0 flex-1 md:flex-none" />
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onNotifications}
          className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-health-surface text-health-text shadow-sm ring-1 ring-health-border/80 transition-all duration-300 hover:shadow-md"
          aria-label={t(lang, "header.notifications")}
        >
          <Bell className="h-5 w-5" strokeWidth={2} />
          {bellUnread ? (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-health-danger ring-2 ring-white" />
          ) : null}
        </button>
        <AccountMenu
          displayName={displayName}
          avatarUrl={avatarUrl}
          onOpenAccount={onOpenAccount}
        />
      </div>
    </header>
  );
}
