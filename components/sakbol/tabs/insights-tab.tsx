"use client";

import { motion } from "framer-motion";
import { Activity, BotMessageSquare } from "lucide-react";
import { AiTab } from "@/components/sakbol/tabs/ai-tab";
import { TrendsTab } from "@/components/sakbol/tabs/trends-tab";
import { useLanguage } from "@/context/language-context";
import { useTabApp } from "@/context/tab-app-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  family: import("@/types/family").FamilyWithProfiles | null;
  reloadFamily: () => void;
  onAnalysesChanged: () => void;
};

export function InsightsTab({ family, reloadFamily, onAnalysesChanged }: Props) {
  const { lang } = useLanguage();
  const { insightsView, setInsightsView } = useTabApp();

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-1 px-3 pt-2 md:max-w-5xl">
        <button
          type="button"
          onClick={() => setInsightsView("trends")}
          className={cn(
            "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all sm:text-caption",
            insightsView === "trends"
              ? "bg-teal-50 text-health-primary shadow-sm ring-1 ring-teal-100"
              : "text-health-text-secondary hover:bg-slate-50",
          )}
        >
          <Activity className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          {t(lang, "nav.insightsTrends")}
        </button>
        <button
          type="button"
          onClick={() => setInsightsView("ai")}
          className={cn(
            "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all sm:text-caption",
            insightsView === "ai"
              ? "bg-teal-50 text-health-primary shadow-sm ring-1 ring-teal-100"
              : "text-health-text-secondary hover:bg-slate-50",
          )}
        >
          <BotMessageSquare className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          {t(lang, "nav.insightsAi")}
        </button>
      </div>

      <motion.div
        key={insightsView}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {insightsView === "trends" ? (
          <TrendsTab family={family} onAnalysesChanged={onAnalysesChanged} />
        ) : (
          <AiTab family={family} reloadFamily={reloadFamily} />
        )}
      </motion.div>
    </div>
  );
}
