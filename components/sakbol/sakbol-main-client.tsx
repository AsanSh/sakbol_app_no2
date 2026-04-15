"use client";

import { useState } from "react";
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

export function SakbolMainClient() {
  const { tab, diaryOpen } = useTabApp();
  const { lang } = useLanguage();
  const { family, loading, reload } = useFamilyDefault();
  const [analysesTick, setAnalysesTick] = useState(0);

  return (
    <div className="flex min-h-dvh bg-[#f8f9fa]">
      {!diaryOpen ? <SakbolDesktopNav /> : null}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <div
          className={
            diaryOpen
              ? "flex min-h-0 flex-1 flex-col"
              : "flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-6"
          }
        >
          {diaryOpen ? (
            <HealthDiaryScreen />
          ) : (
            <>
              {tab === "home" ? <HomeTab family={family} /> : null}
              {tab === "analyses" ? (
                <AnalysesTab onAnalysesChanged={() => setAnalysesTick((k) => k + 1)} />
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
        </div>

        {!diaryOpen ? (
          <p className="mx-auto mb-1 hidden max-w-2xl shrink-0 px-4 text-center text-[10px] text-[#70787d] md:block">
            {t(lang, "analyses.disclaimer")}
          </p>
        ) : null}

        {!diaryOpen ? (
          <div className="md:hidden">
            <BottomTabBar />
          </div>
        ) : null}

        {!diaryOpen ? (
          <p className="mx-auto mb-2 max-w-2xl shrink-0 px-4 pb-1 text-center text-[10px] text-[#70787d] md:hidden">
            {t(lang, "analyses.disclaimer")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
