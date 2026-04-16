"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAnalysesRefresh } from "@/context/analyses-refresh-context";
import { BottomTabBar } from "@/components/sakbol/bottom-tab-bar";
import { HealthDiaryScreen } from "@/components/sakbol/health-diary-screen";
import { MobileBrowserChrome } from "@/components/sakbol/mobile-browser-chrome";
import { AiTab } from "@/components/sakbol/tabs/ai-tab";
import { AnalysesTab } from "@/components/sakbol/tabs/analyses-tab";
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
}: {
  family: ReturnType<typeof useFamilyDefault>["family"];
  loading: boolean;
  reload: () => void;
  analysesTick: number;
  bumpAnalyses: () => void;
}) {
  const { tab, diaryOpen } = useTabApp();

  return (
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
  );
}

/** Оболочка приложения: TWA, мобильный браузер или десктоп «телефон по центру». */
export function SakbolMainClient() {
  const device = useDeviceType();
  const { diaryOpen } = useTabApp();
  const { lang } = useLanguage();
  const { family, loading, reload } = useFamilyDefault();
  const { refreshKey: analysesTick, bumpAnalyses } = useAnalysesRefresh();

  const isDesktopWeb = device === "desktop-web";
  const isMobileBrowser = device === "mobile-web";
  const isTwa = device === "twa";

  const scrollPadBottom =
    isDesktopWeb || diaryOpen
      ? undefined
      : "pb-[calc(7rem+env(safe-area-inset-bottom,0px))]";

  const tabPanels = (
    <TabPanels
      family={family}
      loading={loading}
      reload={reload}
      analysesTick={analysesTick}
      bumpAnalyses={bumpAnalyses}
    />
  );

  if (isDesktopWeb) {
    return (
      <div className="flex min-h-dvh justify-center bg-slate-100">
        <div
          className={cn(
            "flex min-h-dvh w-full max-w-[480px] flex-col bg-white shadow-2xl",
            "overflow-hidden",
          )}
        >
          <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", scrollPadBottom)}>
            {tabPanels}
          </div>
          {!diaryOpen ? (
            <p className="shrink-0 px-4 pb-1 pt-1 text-center text-[10px] text-[#70787d]">
              {t(lang, "analyses.disclaimer")}
            </p>
          ) : null}
          {!diaryOpen ? <BottomTabBar dock="embedded" /> : null}
        </div>
      </div>
    );
  }

  /* TWA + mobile web: полная ширина, нижний бар фиксирован к viewport */
  return (
    <div
      className={cn(
        "flex min-h-[100dvh] flex-col",
        isTwa ? "p-0" : null,
        isMobileBrowser ? "bg-[#f8f9fa]" : null,
      )}
    >
      {isMobileBrowser && !diaryOpen ? <MobileBrowserChrome /> : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto",
            scrollPadBottom,
            isTwa && !diaryOpen ? "min-h-0" : null,
          )}
        >
          {tabPanels}
        </div>
      </div>

      {!diaryOpen ? (
        <p className="mx-auto max-w-2xl shrink-0 px-4 pb-1 text-center text-[10px] text-[#70787d]">
          {t(lang, "analyses.disclaimer")}
        </p>
      ) : null}

      {!diaryOpen ? <BottomTabBar dock="fixed" /> : null}
    </div>
  );
}
