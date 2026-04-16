"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import { Crown, UserPlus } from "lucide-react";
import { ProfileAvatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/sakbol/bottom-sheet";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useActiveProfile } from "@/context/active-profile-context";
import { useTabApp } from "@/context/tab-app-context";
import type { FamilyWithProfiles } from "@/types/family";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import { AnalysesPreview } from "@/components/analyses-preview";
import { hapticImpact } from "@/lib/telegram-haptics";
import { useAnalysesRefresh } from "@/context/analyses-refresh-context";
import { useDeviceType } from "@/hooks/use-device-type";


function greetingRu(hour: number) {
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

type Props = {
  family: FamilyWithProfiles | null;
};

export function HomeTab({ family }: Props) {
  const { refreshKey: analysesRefreshKey } = useAnalysesRefresh();
  const device = useDeviceType();
  const isDesktopWeb = device === "desktop-web";
  const { state, authReady, isAuthenticated } = useTelegramSession();
  const { activeProfileId, setActiveProfileId } = useActiveProfile();
  const { setTab, openDiary } = useTabApp();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [scoreSheetOpen, setScoreSheetOpen] = useState(false);

  const viewerName =
    state.status === "authenticated" ? state.viewer.displayName.split(/\s+/)[0] ?? "друг" : "друг";

  const hour = useMemo(() => new Date().getHours(), []);
  const greet = greetingRu(hour);

  const clinicalId =
    state.status === "authenticated" ? formatClinicalAnonymId(state.viewer.id) : "—";

  const profiles = family?.profiles ?? [];

  /** Стабильный (детерминированный) скор на профиль — меняется при переключении. */
  function profileScore(profileId: string | null): number {
    if (!profileId) return 78;
    const sum = profileId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return 60 + (sum % 36); // диапазон 60–95
  }
  const healthScore = profileScore(activeProfileId);

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

      <BottomSheet open={scoreSheetOpen} title="Health Score" onClose={() => setScoreSheetOpen(false)}>
        {[
          { label: "Анализы крови", v: 82 },
          { label: "Активность", v: 74 },
          { label: "Сон", v: 71 },
          { label: "Питание", v: 69 },
          { label: "Риски", v: 76 },
        ].map((row) => (
          <div key={row.label} className="mb-3">
            <div className="flex justify-between text-xs font-medium text-[#40484c]">
              <span>{row.label}</span>
              <span>{row.v}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f3f4f5]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#004253] to-[#005b71]"
                style={{ width: `${row.v}%` }}
              />
            </div>
          </div>
        ))}
      </BottomSheet>
    </>
  );

  if (isDesktopWeb) {
    const todayLabel = new Date().toLocaleDateString("ru-RU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    return (
      <>
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#eef1f4]">
          <SakbolTopBar
            dense
            showBell
            bellUnread
            onBell={() => setNotificationsOpen(true)}
          />
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-3 pt-2 md:px-5 md:pb-4">
            {authReady && !isAuthenticated ? (
              <div className="shrink-0 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm shadow-amber-900/5">
                <p className="font-semibold tracking-tight">Вход</p>
                <p className="mt-1 text-xs text-amber-900/85">
                  {state.status === "unauthenticated" && state.reason === "web_login_required"
                    ? "Откройте /login или Telegram."
                    : "Требуется авторизация."}
                </p>
                {state.status === "unauthenticated" && state.reason === "web_login_required" ? (
                  <Link
                    href="/login"
                    className="mt-3 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Кирүү
                  </Link>
                ) : null}
              </div>
            ) : null}

            {authReady && isAuthenticated ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-5">
                {/* Левая колонка — финтех-панель */}
                <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white via-white to-slate-50/90 p-5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {greet}
                      </p>
                      <h1 className="mt-1 font-manrope text-2xl font-bold tracking-tight text-slate-900 md:text-[1.65rem]">
                        {viewerName}
                      </h1>
                      <p className="mt-1.5 font-mono text-[11px] text-slate-500">{clinicalId}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900 px-4 py-2.5 text-right shadow-lg shadow-slate-900/25">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Сегодня
                      </p>
                      <p className="text-sm font-semibold text-white">{todayLabel}</p>
                    </div>
                  </div>

                  {profiles.length > 0 ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Семья
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profiles.map((p, i) => {
                          const active = p.id === activeProfileId;
                          const score = 72 + (i % 5) * 4;
                          const isAdmin = p.familyRole === "ADMIN";
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                hapticImpact("medium");
                                setActiveProfileId(p.id);
                              }}
                              className={cn(
                                "group relative flex min-w-[5.5rem] flex-col items-center gap-1 rounded-2xl border-2 px-2.5 pb-2 pt-2.5 text-center transition-all",
                                isAdmin
                                  ? "border-amber-400/90 bg-gradient-to-b from-amber-50 to-amber-100/50 shadow-sm shadow-amber-900/10"
                                  : "border-sky-400/80 bg-gradient-to-b from-sky-50 to-sky-100/40 shadow-sm shadow-sky-900/8",
                                active && "ring-2 ring-slate-900 ring-offset-2",
                              )}
                            >
                              {isAdmin ? (
                                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow ring-2 ring-white">
                                  <Crown size={11} strokeWidth={2.5} aria-hidden />
                                </span>
                              ) : null}
                              <ProfileAvatar
                                src={p.avatarUrl}
                                name={p.displayName}
                                size={44}
                                className="border-2 border-white shadow-md shadow-slate-900/10"
                              />
                              <span className="max-w-[4.5rem] truncate text-center text-[11px] font-semibold text-slate-800">
                                {p.displayName}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                  isAdmin
                                    ? "bg-amber-200/90 text-amber-950"
                                    : "bg-sky-200/90 text-sky-950",
                                )}
                              >
                                {isAdmin ? "Админ" : "Участник"}
                              </span>
                              <span className="text-[10px] font-medium tabular-nums text-slate-500">
                                {score} pts
                              </span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setTab("profile")}
                          className="flex min-w-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-2 py-3 text-slate-500 transition-colors hover:border-slate-400 hover:bg-white"
                        >
                          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white">
                            <UserPlus size={20} strokeWidth={1.5} aria-hidden />
                          </div>
                          <span className="text-[10px] font-semibold">Добавить</span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setScoreSheetOpen(true)}
                    className="relative shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 text-left text-white shadow-xl shadow-slate-900/30 ring-1 ring-white/10 transition-[transform,filter] hover:brightness-[1.03] active:brightness-[0.98]"
                  >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-400/20 blur-2xl" />
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Health Score
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="font-manrope text-3xl font-bold tabular-nums leading-none tracking-tight">
                        {healthScore}
                        <span className="text-lg font-semibold text-cyan-200/90">/100</span>
                      </p>
                      <div className="relative h-16 w-16 shrink-0">
                        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="rgba(255,255,255,0.12)"
                            strokeWidth="3"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="rgb(165,243,252)"
                            strokeDasharray={`${healthScore}, 100`}
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center text-[10px]">
                      <div>
                        <p className="text-slate-400">Сон</p>
                        <p className="font-semibold tabular-nums">7,5 ч</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Шаги</p>
                        <p className="font-semibold tabular-nums">8k</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Ккал</p>
                        <p className="font-semibold tabular-nums">1850</p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab("analyses")}
                    className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm shadow-slate-900/5 transition-colors hover:border-slate-300 hover:bg-slate-50/80"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
                      <MaterialIcon name="cloud_upload" className="text-[22px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold tracking-tight text-slate-900">Загрузить анализ</p>
                      <p className="text-xs text-slate-500">PDF или фото бланка · безопасная обработка</p>
                    </div>
                    <MaterialIcon name="chevron_right" className="text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab("risks")}
                    className="shrink-0 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm shadow-slate-900/5 transition-colors hover:bg-slate-50/90"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-900">
                        Риски здоровья
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        Обзор
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { icon: "cardiology", label: "Сердце" },
                        { icon: "bloodtype", label: "Диабет" },
                        { icon: "radiology", label: "Онко" },
                      ].map((c) => (
                        <div
                          key={c.label}
                          className="rounded-xl border border-slate-100 bg-slate-50/90 p-2 text-center"
                        >
                          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm">
                            <MaterialIcon name={c.icon} className="text-[18px]" />
                          </div>
                          <p className="mt-1 text-[10px] font-semibold text-slate-800">{c.label}</p>
                        </div>
                      ))}
                    </div>
                  </button>

                  <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/80 p-3 shadow-sm">
                    <div className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                        <MaterialIcon name="wb_sunny" className="text-[20px]" />
                      </div>
                      <p className="text-xs leading-snug text-amber-950">
                        <span className="font-semibold">Витамин D</span> ниже целевого — обсудите дозу с врачом.
                      </p>
                    </div>
                  </div>

                  <div className="grid shrink-0 grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={openDiary}
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:bg-slate-50"
                    >
                      <MaterialIcon name="hotel_class" className="text-[20px] text-indigo-600" filled />
                      <p className="mt-2 font-manrope text-xl font-bold tabular-nums text-slate-900">7,2 ч</p>
                      <p className="text-[11px] font-medium text-slate-500">Сон</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("analyses")}
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:bg-slate-50"
                    >
                      <MaterialIcon name="local_fire_department" className="text-[20px] text-orange-500" filled />
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-orange-400 to-amber-400" />
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-slate-500">Ккал · цель</p>
                    </button>
                  </div>
                </div>

                {/* Правая колонка — анализы */}
                <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.15)]">
                  <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
                    <h2 className="font-manrope text-base font-bold tracking-tight text-slate-900">
                      Анализы
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Активный профиль · история и загрузка новых бланков
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden bg-slate-50/40 px-3 pb-3 pt-2 md:px-4">
                    {profiles.length > 0 ? (
                      <AnalysesPreview
                        profiles={profiles}
                        refreshKey={analysesRefreshKey}
                        onRequestUpload={() => setTab("analyses")}
                        compact
                        onOpenAnalyses={() => setTab("analyses")}
                      />
                    ) : (
                      <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
                        Добавьте профиль семьи
                      </div>
                    )}
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
        <div className="rounded-2xl border border-[#ffdcc0] bg-[#ffdcc0]/50 px-4 py-3 text-sm text-[#2d1600]">
          <p className="font-medium">Вход через Telegram Mini App</p>
          <p className="mt-1 text-xs text-[#693c08]">
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
              className="mt-3 inline-flex rounded-xl bg-[#5c3200] px-4 py-2 text-xs font-semibold text-[#ffead4]"
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#70787d]">
          Профиль: {clinicalId} · Бишкек
        </p>
        <h1 className="mt-1 font-manrope text-2xl font-extrabold text-[#191c1d]">
          {greet}, {viewerName}.
        </h1>
        <p className="mt-1 text-sm text-[#40484c]">
          Показатели стабильны — продолжайте отслеживать анализы и сон.
        </p>
      </motion.section>

      {profiles.length > 0 ? (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <p className="mb-2 border-l-4 border-coral pl-2 text-xs font-semibold text-[#40484c]">
            Семья
          </p>
          <div className="flex gap-3 overflow-x-auto px-1 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {profiles.map((p, i) => {
              const active = p.id === activeProfileId;
              const score = 72 + (i % 5) * 4;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    hapticImpact("medium");
                    setActiveProfileId(p.id);
                  }}
                  className="flex shrink-0 flex-col items-center gap-1.5"
                >
                  <ProfileAvatar
                    src={p.avatarUrl}
                    name={p.displayName}
                    size={56}
                    className={cn(
                      "border-2",
                      active ? "border-[#004253] shadow-sm" : "border-transparent",
                    )}
                  />
                  <span className="max-w-[4.5rem] truncate text-center text-[11px] font-medium text-[#40484c]">
                    {p.displayName}
                  </span>
                  <span className="text-[10px] text-[#70787d]">{score}/100</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setTab("analyses")}
              className="flex shrink-0 flex-col items-center gap-1.5 opacity-80"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-[#bfc8cc] text-[#70787d]">
                <UserPlus size={22} strokeWidth={1.5} aria-hidden />
              </div>
              <span className="text-[11px] text-[#70787d]">Добавить</span>
            </button>
          </div>
        </motion.section>
      ) : null}

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.14 }}
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={() => setScoreSheetOpen(true)}
        className="sakbol-web-cta relative w-full overflow-hidden rounded-2xl bg-sakbol-cta p-4 text-left text-white shadow-cta-coral"
      >
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute bottom-0 right-12 h-16 w-16 rounded-full bg-[#8dd0e9]/20" />
        <p className="text-xs font-medium text-[#d4e6e9]">Health Score · нажмите для деталей</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="font-manrope text-4xl font-extrabold leading-none">
              {healthScore}
              <span className="text-lg font-semibold text-[#b7eaff]">/100</span>
            </p>
            <p className="mt-2 flex items-center gap-1 text-[11px] text-[#d4e6e9]">
              <MaterialIcon name="trending_up" className="text-[16px]" filled />
              +2,4% с прошлого месяца
            </p>
          </div>
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#b7eaff"
                strokeDasharray={`${healthScore}, 100`}
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
              <span className="text-[9px] text-[#d4e6e9]">Топ</span>
              <span className="font-manrope text-xs font-bold">15%</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-center text-[11px]">
          <div>
            <MaterialIcon name="bedtime" className="mx-auto text-[18px] text-[#b7eaff]" />
            <p className="mt-1 text-[#d4e6e9]">Сон</p>
            <p className="font-semibold">7,5 ч</p>
          </div>
          <div>
            <MaterialIcon name="footprint" className="mx-auto text-[18px] text-[#b7eaff]" />
            <p className="mt-1 text-[#d4e6e9]">Шаги</p>
            <p className="font-semibold">8 420</p>
          </div>
          <div>
            <MaterialIcon name="local_fire_department" className="mx-auto text-[18px] text-[#b7eaff]" />
            <p className="mt-1 text-[#d4e6e9]">Калории</p>
            <p className="font-semibold">1 850</p>
          </div>
        </div>
      </motion.button>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.21 }}
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={() => setTab("analyses")}
        className="sakbol-web-cta flex w-full items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white/80 p-4 text-left shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#004253] to-[#005b71] text-white">
          <MaterialIcon name="cloud_upload" className="text-[26px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-manrope font-bold text-slate-900">Загрузить анализы</p>
          <p className="text-xs text-slate-500">PDF, фото или ссылка из лаборатории</p>
        </div>
        <MaterialIcon name="chevron_right" className="text-[#bfc8cc]" />
      </motion.button>

      {authReady && isAuthenticated && profiles.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <AnalysesPreview
          profiles={profiles}
          refreshKey={analysesRefreshKey}
          onRequestUpload={() => setTab("analyses")}
        />
        </motion.div>
      ) : null}

      <button
        type="button"
        onClick={() => setTab("risks")}
        className="sakbol-web-cta w-full rounded-2xl border border-[#e7e8e9] bg-white p-4 text-left shadow-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-manrope text-base font-bold text-[#191c1d]">Оценка рисков</p>
          <span className="text-xs font-semibold text-[#004253]">Подробнее</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { icon: "cardiology", label: "Сердце", level: "средний", tone: "text-amber-700" },
            { icon: "bloodtype", label: "Диабет", level: "низкий", tone: "text-emerald-700" },
            { icon: "radiology", label: "Онкология", level: "низкий", tone: "text-emerald-700" },
            { icon: "pulmonology", label: "Дыхание", level: "низкий", tone: "text-emerald-700" },
            { icon: "monitor_weight", label: "Ожирение", level: "средний", tone: "text-amber-700" },
            { icon: "psychology", label: "Нервы", level: "низкий", tone: "text-emerald-700" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-[#f8f9fa] p-2 text-center">
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#d4e6e9]/80 text-[#004253]">
                <MaterialIcon name={c.icon} className="text-[18px]" />
              </div>
              <p className="mt-1 text-[10px] font-semibold text-[#191c1d]">{c.label}</p>
              <p className={cn("text-[10px]", c.tone)}>{c.level}</p>
            </div>
          ))}
        </div>
      </button>

      <div className="rounded-2xl border border-[#ffdcc0]/80 bg-[#ffdcc0] p-4 text-[#2d1600]">
        <div className="flex gap-2">
          <MaterialIcon name="wb_sunny" className="shrink-0 text-[#5c3200]" />
          <div className="min-w-0">
            <p className="font-manrope text-sm font-bold">Витамин D ниже целевого</p>
            <p className="mt-1 text-xs text-[#693c08]">
              Рекомендуем обсудить дозировку с врачом и повторить анализ через 8–12 недель.
            </p>
            <button
              type="button"
              className="mt-3 rounded-full bg-[#5c3200] px-4 py-2 text-xs font-semibold text-[#ffead4]"
            >
              Посмотреть рекомендации
            </button>
          </div>
        </div>
      </div>

      <section>
        <p className="mb-2 font-manrope text-sm font-bold text-[#191c1d]">План действий</p>
        <ul className="space-y-2">
          {[
            { icon: "science", title: "Сдать ЛПНП натощак", sub: "Утро, 8:00", tag: "Срочно", done: false },
            { icon: "pill", title: "Витамин D", sub: "После еды", tag: "Сегодня", done: true },
          ].map((task) => (
            <li
              key={task.title}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-[#e7e8e9] bg-white p-3 shadow-sm",
                task.done && "opacity-55",
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3f4f5] text-[#004253]">
                <MaterialIcon name={task.icon} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium text-[#191c1d]", task.done && "line-through")}>
                  {task.title}
                </p>
                <p className="text-xs text-[#70787d]">{task.sub}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#ffdcc0]/90 px-2 py-0.5 text-[10px] font-semibold text-[#693c08]">
                {task.tag}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={openDiary}
          className="rounded-2xl border border-[#e7e8e9] bg-white p-3 text-left shadow-sm"
        >
          <div className="flex items-center gap-2 text-indigo-600">
            <MaterialIcon name="hotel_class" className="text-[22px]" filled />
            <span className="text-xs font-bold text-[#191c1d]">Сон</span>
          </div>
          <p className="mt-2 font-manrope text-xl font-extrabold text-[#191c1d]">7,2 ч</p>
          <p className="text-[10px] text-[#70787d]">Дневник здоровья</p>
        </button>
        <button
          type="button"
          onClick={() => setTab("analyses")}
          className="rounded-2xl border border-[#e7e8e9] bg-white p-3 text-left shadow-sm"
        >
          <div className="flex items-center gap-2 text-orange-600">
            <MaterialIcon name="local_fire_department" className="text-[22px]" filled />
            <span className="text-xs font-bold text-[#191c1d]">Калории</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f3f4f5]">
            <div className="h-full w-[72%] rounded-full bg-orange-500" />
          </div>
          <p className="mt-1 text-[10px] text-[#70787d]">Цель 2200 · Анализы</p>
        </button>
      </div>

      {sharedSheets}
      </motion.div>
    </div>
  );
}
