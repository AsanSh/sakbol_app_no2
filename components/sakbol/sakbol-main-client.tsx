"use client";

import { Suspense, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAnalysesRefresh } from "@/context/analyses-refresh-context";
import { BottomTabBar } from "@/components/sakbol/bottom-tab-bar";
import { SakbolDesktopSidebar } from "@/components/sakbol/sakbol-desktop-sidebar";
import { AnalysesTab } from "@/components/sakbol/tabs/analyses-tab";
import { HomeTab } from "@/components/sakbol/tabs/home-tab";
import { InsightsTab } from "@/components/sakbol/tabs/insights-tab";
import { ProfileTabSakbol } from "@/components/sakbol/tabs/profile-tab-sakbol";
import { PharmacyTab } from "@/features/pharmacy/pharmacy-tab";
import { DoctorDiscoveryHome } from "@/features/home/doctor-discovery-home";
import { DoctorPatientsSection } from "@/features/doctor/my-patients-tab";
import { useTabApp } from "@/context/tab-app-context";
import { useLanguage } from "@/context/language-context";
import { useFamilyDefault } from "@/hooks/use-family-default";
import { useDeviceType } from "@/hooks/use-device-type";
import { t } from "@/lib/i18n";
import { showPatientsTabForFamily } from "@/lib/show-patients-tab";
import { cn } from "@/lib/utils";

function TabPanels({
  family,
  loading,
  reload,
  bumpAnalyses,
}: {
  family: ReturnType<typeof useFamilyDefault>["family"];
  loading: boolean;
  reload: () => void;
  bumpAnalyses: () => void;
}) {
  const { tab, insightsView } = useTabApp();
  const isAiInsights = tab === "insights" && insightsView === "ai";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          isAiInsights ? "min-h-0 overflow-hidden" : "overflow-y-auto",
        )}
      >
        {tab === "home" ? (
          <Suspense fallback={<div className="min-h-[40vh]" />}>
            <HomeTab family={family} reloadFamily={reload} />
          </Suspense>
        ) : null}
        {tab === "analyses" ? (
          <AnalysesTab
            family={family}
            onAnalysesChanged={() => {
              bumpAnalyses();
            }}
          />
        ) : null}
        {tab === "insights" ? (
          <InsightsTab
            family={family}
            reloadFamily={reload}
            onAnalysesChanged={() => {
              bumpAnalyses();
            }}
          />
        ) : null}
        {tab === "patients" ? (
          <DoctorPatientsSection family={family} loading={loading} variant="page" />
        ) : null}
        {tab === "pharmacy" ? <PharmacyTab /> : null}
        {tab === "doctors" ? (
          <Suspense fallback={<div className="min-h-[40vh]" />}>
            <DoctorDiscoveryHome />
          </Suspense>
        ) : null}
        {tab === "profile" ? (
          <ProfileTabSakbol family={family} loading={loading} reload={reload} />
        ) : null}
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
  const { lang } = useLanguage();
  const { tab, insightsView, setTab } = useTabApp();
  const { family, loading, reload } = useFamilyDefault();
  const { bumpAnalyses } = useAnalysesRefresh();
  const showPatientsNav = showPatientsTabForFamily(family, loading);

  useEffect(() => {
    if (tab === "patients" && !showPatientsNav && !loading) {
      setTab("profile");
    }
  }, [tab, showPatientsNav, loading, setTab]);

  const isDesktopWeb = device === "desktop-web";

  const tabPanels = (
    <TabPanels family={family} loading={loading} reload={reload} bumpAnalyses={bumpAnalyses} />
  );

  if (isDesktopWeb) {
    return (
      <div className="flex h-dvh max-h-dvh w-full overflow-hidden bg-ui-canvas">
        <SakbolDesktopSidebar showPatientsTab={showPatientsNav} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-ui-canvas">
            <div
              className={cn(
                "sakbol-dashboard-main mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col",
                "px-4 py-3 md:px-8 md:py-4",
                tab === "insights" && insightsView === "ai"
                  ? "overflow-hidden"
                  : "overflow-y-auto",
              )}
            >
              {tabPanels}
            </div>
            <p className="shrink-0 border-t border-health-border/80 bg-health-surface/90 px-4 py-2 text-center text-[10px] text-health-text-secondary">
              {t(lang, "analyses.disclaimer")}
            </p>
          </main>
        </div>
      </div>
    );
  }

  /* Telegram + мобильный веб: как мини-приложение — нижний бар, без отдельной «сайтовой» шапки */
  return (
    <div className="flex min-h-[100dvh] flex-col bg-ui-canvas">
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            tab === "insights" && insightsView === "ai"
              ? "overflow-hidden pb-[calc(3.35rem+env(safe-area-inset-bottom,0px))]"
              : "overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom,0px))]",
          )}
        >
          {tabPanels}
        </div>
      </div>

      <p className="mx-auto max-w-2xl shrink-0 px-4 pb-1 text-center text-[10px] text-health-text-secondary">
        {t(lang, "analyses.disclaimer")}
      </p>

      <BottomTabBar dock="fixed" showPatientsTab={showPatientsNav} />
    </div>
  );
}
