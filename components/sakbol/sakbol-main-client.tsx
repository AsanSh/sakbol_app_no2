"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAnalysesRefresh } from "@/context/analyses-refresh-context";
import { BottomTabBar } from "@/components/sakbol/bottom-tab-bar";
import { SakbolDesktopSidebar } from "@/components/sakbol/sakbol-desktop-sidebar";
import { HealthDiaryScreen } from "@/components/sakbol/health-diary-screen";
import { AiTab } from "@/components/sakbol/tabs/ai-tab";
import { AnalysesTab } from "@/components/sakbol/tabs/analyses-tab";
import { TrendsTab } from "@/components/sakbol/tabs/trends-tab";
import { HomeTab } from "@/components/sakbol/tabs/home-tab";
import { ProfileTabSakbol } from "@/components/sakbol/tabs/profile-tab-sakbol";
import { RisksTab } from "@/components/sakbol/tabs/risks-tab";
import { useTabApp } from "@/context/tab-app-context";
import { useLanguage } from "@/context/language-context";
import { useFamilyDefault } from "@/hooks/use-family-default";
import { useDeviceType } from "@/hooks/use-device-type";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function TabPanels({
  family,
  loading,
  reload,
  analysesTick,
  bumpAnalyses,
  desktopWeb,
}: {
  family: ReturnType<typeof useFamilyDefault>["family"];
  loading: boolean;
  reload: () => void;
  analysesTick: number;
  bumpAnalyses: () => void;
  desktopWeb: boolean;
}) {
  const { tab, diaryOpen } = useTabApp();
  const homeOneScreen = desktopWeb && !diaryOpen && tab === "home";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={diaryOpen ? "diary" : tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          homeOneScreen ? "overflow-hidden" : "overflow-y-auto",
        )}
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
            {tab === "trends" ? (
              <TrendsTab
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
  );
}

/**
 * Telegram Mini App и мобильный браузер — один ответ (нижние вкладки, полная ширина).
 * Десктопный браузер (не TWA, ширина ≥ 1024) — дашборд: боковое меню + широкая область контента.
 */
export function SakbolMainClient() {
  const device = useDeviceType();
  const { diaryOpen, tab } = useTabApp();
  const { lang } = useLanguage();
  const { family, loading, reload } = useFamilyDefault();
  const { refreshKey: analysesTick, bumpAnalyses } = useAnalysesRefresh();

  const isDesktopWeb = device === "desktop-web";

  const tabPanels = (
    <TabPanels
      family={family}
      loading={loading}
      reload={reload}
      analysesTick={analysesTick}
      bumpAnalyses={bumpAnalyses}
      desktopWeb={isDesktopWeb}
    />
  );

  const desktopHomeNoScroll = isDesktopWeb && !diaryOpen && tab === "home";

  if (isDesktopWeb) {
    return (
      <div className="flex h-dvh max-h-dvh w-full overflow-hidden bg-health-bg">
        {!diaryOpen ? <SakbolDesktopSidebar /> : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-health-bg">
            <div
              className={cn(
                "sakbol-dashboard-main mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col",
                "px-4 py-3 md:px-8 md:py-4",
                desktopHomeNoScroll ? "overflow-hidden" : "overflow-y-auto",
              )}
            >
              {tabPanels}
            </div>
            {!diaryOpen ? (
              <p className="shrink-0 border-t border-health-border/80 bg-health-surface/90 px-4 py-2 text-center text-[10px] text-health-text-secondary">
                {t(lang, "analyses.disclaimer")}
              </p>
            ) : null}
          </main>
        </div>
      </div>
    );
  }

  /* Telegram + мобильный веб: как мини-приложение — нижний бар, без отдельной «сайтовой» шапки */
  return (
    <div className="flex min-h-[100dvh] flex-col bg-health-bg">
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto",
            !diaryOpen && "pb-[calc(7rem+env(safe-area-inset-bottom,0px))]",
          )}
        >
          {tabPanels}
        </div>
      </div>

      {!diaryOpen ? (
        <p className="mx-auto max-w-2xl shrink-0 px-4 pb-1 text-center text-[10px] text-health-text-secondary">
          {t(lang, "analyses.disclaimer")}
        </p>
      ) : null}

      {!diaryOpen ? <BottomTabBar dock="fixed" /> : null}
    </div>
  );
}
