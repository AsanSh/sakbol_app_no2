"use client";

import { ChevronDown } from "lucide-react";
import { ProfileAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
  onOpenAccount: () => void;
  className?: string;
};

export function AccountMenu({ displayName, avatarUrl, onOpenAccount, className }: Props) {
  const { lang } = useLanguage();

  return (
    <button
      type="button"
      onClick={onOpenAccount}
      className={cn(
        "flex min-h-[44px] max-w-[14rem] items-center gap-2 rounded-xl bg-health-surface py-1.5 pl-1.5 pr-2 shadow-sm ring-1 ring-health-border/80 transition-all hover:shadow-md",
        className,
      )}
      aria-label={t(lang, "header.account")}
    >
      <ProfileAvatar src={avatarUrl ?? null} name={displayName} size={36} />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-caption font-semibold text-health-text">{displayName}</p>
        <p className="truncate text-[10px] font-medium text-health-text-secondary">
          {t(lang, "header.account")}
        </p>
      </div>
      <ChevronDown className="h-4 w-4 shrink-0 text-health-text-secondary" aria-hidden />
    </button>
  );
}
