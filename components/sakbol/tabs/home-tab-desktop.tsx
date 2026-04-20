"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { DesktopDashboardHeader } from "@/components/dashboard/desktop-dashboard-header";
import { DisclaimerCard } from "@/components/dashboard/disclaimer-card";
import { ExamsSection } from "@/components/dashboard/exams-section";
import { FamilyDashboardSection } from "@/components/dashboard/family-dashboard-section";
import { GreetingCard } from "@/components/dashboard/greeting-card";
import { AnthropometryBlock } from "@/components/dashboard/anthropometry-block";
import { InsightsRail } from "@/components/dashboard/insights-rail";
import type { FamilyWithProfiles } from "@/types/family";
import type { TelegramSessionState } from "@/context/telegram-session-context";
import type { MainTab } from "@/context/tab-app-context";
import { useLanguage } from "@/context/language-context";
import { dashboardGreetingForHour } from "@/lib/i18n";

type Props = {
  family: FamilyWithProfiles | null;
  authReady: boolean;
  isAuthenticated: boolean;
  state: TelegramSessionState;
  activeProfileId: string | null;
  setActiveProfileId: (id: string) => void;
  setTab: (t: MainTab) => void;
  viewerName: string;
  clinicalId: string;
  analysesRefreshKey: number;
  onOpenNotifications: () => void;
  sharedSheets: ReactNode;
};

export function HomeTabDesktop({
  family,
  authReady,
  isAuthenticated,
  state,
  activeProfileId,
  setActiveProfileId,
  setTab,
  viewerName,
  clinicalId,
  analysesRefreshKey,
  onOpenNotifications,
  sharedSheets,
}: Props) {
  const { lang } = useLanguage();
  const profiles = family?.profiles ?? [];
  const hour = new Date().getHours();
  const greetPrefix = dashboardGreetingForHour(lang, hour);
  const dateLocale = lang === "kg" ? "ky-KG" : "ru-RU";
  const todayLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const displayName = activeProfile?.displayName ?? viewerName;
  const lastUpdatedLine = `${clinicalId} · ${todayLabel}`;

  return (
    <>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent">
        <DesktopDashboardHeader
          displayName={displayName}
          avatarUrl={activeProfile?.avatarUrl}
          onNotifications={onOpenNotifications}
          onOpenAccount={() => setTab("profile")}
          bellUnread
        />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pb-4 pt-1">
          {authReady && !isAuthenticated ? (
            <div className="shrink-0 rounded-2xl bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/80">
              <p className="font-semibold tracking-tight">Нужен вход</p>
              <p className="mt-1 text-caption text-amber-900/90">
                {state.status === "unauthenticated" && state.reason === "web_login_required"
                  ? "Сессия не найдена. Откройте вход: код из Telegram или email и пароль."
                  : state.status === "unauthenticated" && state.reason === "telegram_init_data_missing"
                    ? "Мини-приложение: закройте и откройте снова из бота. Или войдите через сайт в браузере."
                    : state.status === "unauthenticated" && state.reason === "no_init_data"
                      ? "Откройте сервис в Telegram или используйте dev-вход на /login."
                      : "Требуется авторизация."}
              </p>
              {state.status === "unauthenticated" &&
              (state.reason === "web_login_required" || state.reason === "telegram_init_data_missing") ? (
                <Link
                  href="/login"
                  className="mt-3 inline-flex rounded-xl bg-health-text px-4 py-2 text-caption font-semibold text-health-surface"
                >
                  Войти на сайте
                </Link>
              ) : null}
            </div>
          ) : null}

          {authReady && isAuthenticated ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden">
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 xl:gap-6">
                <div className="flex flex-col gap-4 lg:col-span-7">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <GreetingCard
                      displayName={displayName}
                      greetPrefix={greetPrefix}
                      onUpload={() => setTab("analyses")}
                      onOpenDynamics={() => setTab("trends")}
                      onAskAI={() => setTab("ai")}
                      onOpenFamily={() => setTab("profile")}
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <AnthropometryBlock
                      bloodType={activeProfile?.bloodType ?? null}
                      heightCm={
                        typeof activeProfile?.heightCm === "number" ? activeProfile.heightCm : null
                      }
                      weightKg={
                        typeof activeProfile?.weightKg === "number" ? activeProfile.weightKg : null
                      }
                      lastUpdatedLine={lastUpdatedLine}
                      onFillProfile={() => setTab("profile")}
                    />
                  </motion.div>
                  {profiles.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <FamilyDashboardSection
                        profiles={profiles}
                        activeProfileId={activeProfileId}
                        onSelectProfile={setActiveProfileId}
                        onManageFamily={() => setTab("profile")}
                        onAddMember={() => setTab("profile")}
                      />
                    </motion.div>
                  ) : null}
                </div>

                <motion.div
                  className="flex min-h-[min(24rem,55vh)] min-h-0 flex-col lg:col-span-5 lg:min-h-0"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ExamsSection
                    profiles={profiles}
                    refreshKey={analysesRefreshKey}
                    onUploadAnalysis={() => setTab("analyses")}
                    onOpenAnalyses={() => setTab("analyses")}
                    compact
                    className="min-h-0 flex-1"
                  />
                </motion.div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
                <div className="lg:col-span-9">
                  <DisclaimerCard />
                </div>
                <div className="lg:col-span-3">
                  <InsightsRail className="lg:sticky lg:top-20" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {sharedSheets}
    </>
  );
}
