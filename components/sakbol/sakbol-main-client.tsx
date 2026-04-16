"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAnalysesRefresh } from "@/context/analyses-refresh-context";
import { BottomTabBar } from "@/components/sakbol/bottom-tab-bar";
import { SakbolDesktopNav } from "@/components/sakbol/desktop-nav";
import { HealthDiaryScreen } from "@/components/sakbol/health-diary-screen";
import { AiTab } from "@/components/sakbol/tabs/ai-tab";
import { AnalysesTab } from "@/components/sakbol/tabs/analyses-tab";
import { HomeTab } from "@/components/sakbol/tabs/home-tab";
import { ProfileTabSakbol } from "@/components/sakbol/tabs/profile-tab-sakbol";
import { RisksTab } from "@/components/sakbol/tabs/risks-tab";
import { useTabApp } from "@/context/tab-app-context";
import { useLanguage } from "@/context/language-context";
import { useFamilyDefault } from "@/hooks/use-family-default";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function SakbolMainClient() {
  const { tab, diaryOpen } = useTabApp();
  const { lang } = useLanguage();
  const { family, loading, reload } = useFamilyDefault();
  const { refreshKey: analysesTick, bumpAnalyses } = useAnalysesRefresh();

  return (
    <div className="flex min-h-dvh lg:bg-gradient-to-b lg:from-slate-100 lg:to-slate-200">
      {!diaryOpen ? <SakbolDesktopNav /> : null}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col lg:items-center">
        <div
          className={
            diaryOpen
              ? "flex min-h-0 w-full flex-1 flex-col"
              : cn(
                  "sakbol-narrow-app flex min-h-0 w-full max-w-[480px] flex-1 flex-col overflow-y-auto",
                  "pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-6",
                  "bg-white/55 backdrop-blur-md lg:bg-white lg:backdrop-blur-none",
                  "shadow-[0_0_0_1px_rgba(16,185,129,0.08)] lg:border-x lg:border-slate-200/90 lg:shadow-2xl",
                  "lg:my-4 lg:max-h-[min(100dvh-2rem,56rem)] lg:min-h-0 lg:rounded-2xl",
                )
          }
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={diaryOpen ? "diary" : tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              {diaryOpen ? (
                <HealthDiaryScreen />
              ) : (
                <>
                  {tab === "home" ? <HomeTab family={family} /> : null}
                  {tab === "analyses" ? (
                    <AnalysesTab
                      onAnalysesChanged={() => {
                        bumpAnalyses();
                        reload();
                      }}
                    />
                  ) : null}
                  {tab === "risks" ? (
                    <RisksTab
                      family={family}
                      familyLoading={loading}
                      analysesRefreshKey={analysesTick}
                    />
                  ) : null}
                  {tab === "ai" ? <AiTab /> : null}
                  {tab === "profile" ? (
                    <ProfileTabSakbol family={family} loading={loading} reload={reload} />
                  ) : null}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {!diaryOpen ? (
          <p className="mx-auto mb-1 hidden max-w-2xl shrink-0 px-4 text-center text-[10px] text-[#70787d] lg:block">
            {t(lang, "analyses.disclaimer")}
          </p>
        ) : null}

        {!diaryOpen ? (
          <div className="lg:hidden">
            <BottomTabBar />
          </div>
        ) : null}

        {!diaryOpen ? (
          <p className="mx-auto mb-2 max-w-2xl shrink-0 px-4 pb-1 text-center text-[10px] text-[#70787d] lg:hidden">
            {t(lang, "analyses.disclaimer")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
