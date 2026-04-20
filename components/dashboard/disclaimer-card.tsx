"use client";

import { AlertTriangle } from "lucide-react";
import { DsCard } from "@/components/ui/ds-card";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = { className?: string };

export function DisclaimerCard({ className }: Props) {
  const { lang } = useLanguage();

  return (
    <DsCard
      variant="muted"
      className={cn("flex gap-3 bg-slate-100/95 ring-slate-200/80", className)}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900 ring-1 ring-amber-200/80">
        <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 space-y-2 text-body text-health-text-secondary">
        <p>{t(lang, "dashboard.disclaimer.line1")}</p>
        <p>{t(lang, "dashboard.disclaimer.line2")}</p>
      </div>
    </DsCard>
  );
}
