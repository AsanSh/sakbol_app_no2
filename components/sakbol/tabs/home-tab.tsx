"use client";

import { useMemo, useState } from "react";
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
import type { FamilyWithProfiles } from "@/types/family";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import { AnalysesPreview } from "@/components/analyses-preview";
import { hapticImpact } from "@/lib/telegram-haptics";
import { useAnalysesRefresh } from "@/context/analyses-refresh-context";


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
      </motion.div>
    </div>
  );
}
