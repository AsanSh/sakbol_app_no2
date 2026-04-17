"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import { UserPlus } from "lucide-react";
import { ProfileAvatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/sakbol/bottom-sheet";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useActiveProfile } from "@/context/active-profile-context";
import { useTabApp } from "@/context/tab-app-context";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import type { FamilyWithProfiles } from "@/types/family";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import { AnalysesPreview } from "@/components/analyses-preview";
import { hapticImpact } from "@/lib/telegram-haptics";
import { useAnalysesRefresh } from "@/context/analyses-refresh-context";
import { useDeviceType } from "@/hooks/use-device-type";
import { HomeTabDesktop } from "@/components/sakbol/tabs/home-tab-desktop";
import { profileKinshipLabelRu } from "@/lib/profile-kinship";

function greetingRu(hour: number) {
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

type Props = {
  family: FamilyWithProfiles | null;
};

export function HomeTab({ family }: Props) {
  const { lang } = useLanguage();
  const { refreshKey: analysesRefreshKey } = useAnalysesRefresh();
  const device = useDeviceType();
  const isDesktopWeb = device === "desktop-web";
  const { state, authReady, isAuthenticated } = useTelegramSession();
  const { activeProfileId, setActiveProfileId } = useActiveProfile();
  const { setTab } = useTabApp();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const viewerName =
    state.status === "authenticated" ? state.viewer.displayName.split(/\s+/)[0] ?? "друг" : "друг";

  const [greet, setGreet] = useState(() => greetingRu(new Date().getHours()));
  useEffect(() => {
    const tick = () => setGreet(greetingRu(new Date().getHours()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const clinicalId =
    state.status === "authenticated" ? formatClinicalAnonymId(state.viewer.id) : "—";

  const profiles = family?.profiles ?? [];

  const notifications = [
    { icon: "lab_research", title: "Готов расшифровка анализа", time: "09:12" },
    { icon: "event", title: "Напоминание: витамин D", time: "Вчера" },
  ];

  const sharedSheets = (
    <>
      <BottomSheet open={notificationsOpen} title="Уведомления" onClose={() => setNotificationsOpen(false)}>
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li key={n.title} className="flex gap-3 rounded-xl bg-[#f8f9fa] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#004253] shadow-sm">
                <MaterialIcon name={n.icon} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#191c1d]">{n.title}</p>
                <p className="text-xs text-[#70787d]">{n.time}</p>
              </div>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );

  if (isDesktopWeb) {
    return (
      <HomeTabDesktop
        family={family}
        authReady={authReady}
        isAuthenticated={isAuthenticated}
        state={state}
        activeProfileId={activeProfileId}
        setActiveProfileId={setActiveProfileId}
        setTab={setTab}
        viewerName={viewerName}
        greet={greet}
        clinicalId={clinicalId}
        analysesRefreshKey={analysesRefreshKey}
        onOpenNotifications={() => setNotificationsOpen(true)}
        sharedSheets={sharedSheets}
      />
    );
  }

  return (
    <div className="w-full">
      <SakbolTopBar
        showBell
        bellUnread
        onBell={() => setNotificationsOpen(true)}
      />
      <motion.div
        className="mx-auto max-w-2xl space-y-4 px-4 pb-4 pt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
      {authReady && !isAuthenticated ? (
        <div className="rounded-2xl bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/80">
          <p className="font-semibold">Вход через Telegram Mini App</p>
          <p className="mt-1 text-caption text-amber-900/90">
            {state.status === "unauthenticated" && state.reason === "web_login_required"
              ? "Сессия в браузере жок. Кирүү үчүн /login бетин ачыңыз же Telegram аркылуу кирүү."
              : state.status === "unauthenticated" && state.reason === "no_init_data"
                ? "Откройте приложение в Telegram. Демо-вход в браузере: ALLOW_DEV_LOGIN на сервере и кнопка на /login."
                : state.status === "unauthenticated" && state.reason === "telegram_init_data_missing"
                  ? "Закройте мини-приложение полностью и откройте снова из бота."
                  : "Требуется авторизация для загрузки анализов и семейного профиля. Проверьте TELEGRAM_BOT_TOKEN, SESSION_SECRET и DATABASE_URL на сервере."}
          </p>
          {state.status === "unauthenticated" && state.reason === "web_login_required" ? (
            <Link
              href="/login"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-health-text px-4 py-2 text-caption font-semibold text-health-surface"
            >
              Страница входа
            </Link>
          ) : null}
          {state.status === "unauthenticated" &&
          state.reason &&
          state.reason !== "no_init_data" &&
          state.reason !== "telegram_init_data_missing" &&
          state.reason !== "web_login_required" ? (
            <p className="mt-2 rounded-lg bg-white/60 px-2 py-1.5 font-mono text-[10px] leading-snug text-[#5c3200]">
              {state.reason}
            </p>
          ) : null}
        </div>
      ) : null}

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <p className="text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
          Профиль: {clinicalId} · Бишкек
        </p>
        <h1 className="mt-1 font-manrope text-h2 font-bold tracking-tight text-health-text sm:text-display sm:leading-[2.5rem]">
          {greet}, {viewerName}.
        </h1>
        <p className="mt-1 text-body text-health-text-secondary">
          Загружайте анализы и следите за динамикой — так картина здоровья будет точнее.
        </p>
      </motion.section>

      {profiles.length > 0 ? (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
            Семья
          </p>
          <div className="flex gap-3 overflow-x-auto px-1 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {profiles.map((p) => {
              const active = p.id === activeProfileId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    hapticImpact("medium");
                    setActiveProfileId(p.id);
                  }}
                  className="flex shrink-0 flex-col items-center gap-1"
                >
                  <ProfileAvatar
                    src={p.avatarUrl}
                    name={p.displayName}
                    size={56}
                    className={cn(
                      "ring-1 ring-offset-1 ring-offset-health-bg transition-shadow",
                      active ? "ring-health-primary/90 shadow-sm" : "ring-transparent",
                    )}
                  />
                  <span className="max-w-[4.5rem] truncate text-center text-[11px] font-medium text-health-text">
                    {p.displayName}
                  </span>
                  <span className="max-w-[4.5rem] truncate text-center text-[10px] text-health-text-secondary">
                    {profileKinshipLabelRu(p)}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setTab("profile")}
              className="flex shrink-0 flex-col items-center gap-1.5 opacity-90"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-health-border bg-health-surface text-health-text-secondary shadow-sm">
                <UserPlus size={22} strokeWidth={1.5} aria-hidden />
              </div>
              <span className="text-[11px] font-medium text-health-text-secondary">Добавить</span>
            </button>
          </div>
        </motion.section>
      ) : null}

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.21 }}
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={() => setTab("analyses")}
        className="flex w-full min-h-[52px] items-center gap-3 rounded-2xl bg-health-surface p-4 text-left shadow-md shadow-slate-900/[0.06] ring-1 ring-health-border/80 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-health-primary to-teal-700 text-white shadow-md">
          <MaterialIcon name="cloud_upload" className="text-[26px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-manrope font-bold text-slate-900">Загрузить анализы</p>
          <p className="text-xs text-slate-500">PDF, фото или ссылка из лаборатории</p>
        </div>
        <MaterialIcon name="chevron_right" className="text-[#bfc8cc]" />
      </motion.button>

      {authReady && isAuthenticated && profiles.length > 0 ? (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => setTab("trends")}
          className="flex w-full min-h-[52px] items-center gap-3 rounded-2xl bg-teal-50/90 p-4 text-left shadow-md shadow-slate-900/[0.05] ring-1 ring-teal-100/90 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-md">
            <MaterialIcon name="trending_up" className="text-[26px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-manrope font-bold text-slate-900">{t(lang, "home.trendsCtaTitle")}</p>
            <p className="text-xs text-slate-600">{t(lang, "home.trendsCtaSubtitle")}</p>
          </div>
          <MaterialIcon name="chevron_right" className="text-[#bfc8cc]" />
        </motion.button>
      ) : null}

      {authReady && isAuthenticated && profiles.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <AnalysesPreview
          profiles={profiles}
          refreshKey={analysesRefreshKey}
          onRequestUpload={() => setTab("analyses")}
        />
        </motion.div>
      ) : null}

      {sharedSheets}
      </motion.div>
    </div>
  );
}
