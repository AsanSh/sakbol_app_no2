"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Crown, UserPlus } from "lucide-react";
import { AnalysesPreview } from "@/components/analyses-preview";
import { DesktopDashboardHeader } from "@/components/dashboard/desktop-dashboard-header";
import { InsightsRail } from "@/components/dashboard/insights-rail";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import { DsCard } from "@/components/ui/ds-card";
import { HealthScoreRing } from "@/components/ui/health-score-ring";
import { StatChip } from "@/components/ui/stat-chip";
import { ProfileAvatar } from "@/components/ui/avatar";
import type { FamilyWithProfiles } from "@/types/family";
import type { TelegramSessionState } from "@/context/telegram-session-context";
import type { MainTab } from "@/context/tab-app-context";
import { hapticImpact } from "@/lib/telegram-haptics";
import { ageYearsFromIsoDob } from "@/lib/risk-scores";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

type Props = {
  family: FamilyWithProfiles | null;
  authReady: boolean;
  isAuthenticated: boolean;
  state: TelegramSessionState;
  activeProfileId: string | null;
  setActiveProfileId: (id: string) => void;
  setTab: (t: MainTab) => void;
  openDiary: () => void;
  viewerName: string;
  greet: string;
  clinicalId: string;
  healthScore: number;
  profileScore: (id: string | null) => number;
  analysesRefreshKey: number;
  onOpenNotifications: () => void;
  onOpenScoreDetail: () => void;
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
  openDiary,
  viewerName,
  greet,
  clinicalId,
  healthScore,
  profileScore,
  analysesRefreshKey,
  onOpenNotifications,
  onOpenScoreDetail,
  sharedSheets,
}: Props) {
  const { lang } = useLanguage();
  const profiles = family?.profiles ?? [];
  const todayLabel = new Date().toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const activeAge = activeProfile?.dateOfBirth
    ? ageYearsFromIsoDob(activeProfile.dateOfBirth)
    : null;
  const familyAvg =
    profiles.length > 0
      ? Math.round(profiles.reduce((sum, p) => sum + profileScore(p.id), 0) / profiles.length)
      : null;
  const scoreLabel =
    healthScore >= 85 ? "Отличное состояние" : healthScore >= 72 ? "Хороший фон" : "Зоны внимания";

  const ctaBase =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-caption font-semibold transition-all duration-300";
  const ctaPrimary = `${ctaBase} bg-health-primary text-white shadow-md shadow-teal-900/15 hover:bg-teal-700`;
  const ctaSecondary = `${ctaBase} bg-health-surface text-health-text shadow-sm ring-1 ring-health-border hover:shadow-md`;

  return (
    <>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent">
        <DesktopDashboardHeader
          displayName={activeProfile?.displayName ?? viewerName}
          avatarUrl={activeProfile?.avatarUrl}
          onNotifications={onOpenNotifications}
          bellUnread
        />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pb-4 pt-1">
          {authReady && !isAuthenticated ? (
            <div className="shrink-0 rounded-2xl bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/80">
              <p className="font-semibold tracking-tight">Вход</p>
              <p className="mt-1 text-caption text-amber-900/90">
                {state.status === "unauthenticated" && state.reason === "web_login_required"
                  ? "Откройте /login или Telegram."
                  : "Требуется авторизация."}
              </p>
              {state.status === "unauthenticated" && state.reason === "web_login_required" ? (
                <Link
                  href="/login"
                  className="mt-3 inline-flex rounded-xl bg-health-text px-4 py-2 text-caption font-semibold text-health-surface"
                >
                  Кирүү
                </Link>
              ) : null}
            </div>
          ) : null}

          {authReady && isAuthenticated ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-12 lg:gap-5 xl:gap-6">
              <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden lg:col-span-5">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <DsCard className="relative overflow-hidden">
                    <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl" />
                    <div className="relative flex flex-wrap items-start gap-4">
                      <ProfileAvatar
                        src={activeProfile?.avatarUrl}
                        name={activeProfile?.displayName ?? viewerName}
                        size={80}
                        className="shrink-0 shadow-health-lift ring-4 ring-white"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
                          {greet}
                        </p>
                        <h1 className="mt-1 font-manrope text-display font-bold tracking-tight text-health-text md:text-[2.25rem]">
                          {activeProfile?.displayName ?? viewerName}
                        </h1>
                        <p className="mt-1 text-body text-health-text-secondary">
                          {activeAge != null ? `${activeAge} лет · активный профиль` : "Активный профиль"}
                        </p>
                        <p className="mt-3 max-w-md text-body leading-relaxed text-health-text-secondary">
                          Ваш индекс здоровья стабильно растёт — около{" "}
                          <span className="font-semibold text-health-primary">+12%</span> к прошлому месяцу
                          (демо-тренд). Продолжайте загружать анализы и вести дневник.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" className={ctaPrimary} onClick={() => setTab("analyses")}>
                            <MaterialIcon name="cloud_upload" className="text-[18px]" />
                            Загрузить анализ
                          </button>
                          <button type="button" className={ctaSecondary} onClick={() => setTab("trends")}>
                            <MaterialIcon name="trending_up" className="text-[18px]" />
                            {t(lang, "home.trendsOpen")}
                          </button>
                          <button type="button" className={ctaSecondary} onClick={() => setTab("ai")}>
                            <MaterialIcon name="auto_awesome" className="text-[18px]" />
                            Спросить ИИ
                          </button>
                          <button type="button" className={ctaSecondary} onClick={() => setTab("profile")}>
                            <MaterialIcon name="group_add" className="text-[18px]" />
                            Семья
                          </button>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                          {[
                            {
                              label: "Группа крови",
                              value: activeProfile?.bloodType?.trim() || "—",
                            },
                            {
                              label: "Рост",
                              value:
                                typeof activeProfile?.heightCm === "number"
                                  ? `${activeProfile.heightCm} см`
                                  : "—",
                            },
                            {
                              label: "Вес",
                              value:
                                typeof activeProfile?.weightKg === "number"
                                  ? `${activeProfile.weightKg} кг`
                                  : "—",
                            },
                          ].map((cell) => (
                            <div
                              key={cell.label}
                              className="rounded-xl bg-slate-50/90 px-2 py-2 text-center shadow-sm ring-1 ring-health-border/60"
                            >
                              <p className="text-[10px] font-medium uppercase tracking-wide text-health-text-secondary">
                                {cell.label}
                              </p>
                              <p className="mt-0.5 text-sm font-bold tabular-nums text-health-text">
                                {cell.value}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 font-mono text-[10px] text-health-text-secondary">
                          {clinicalId} · {todayLabel}
                        </p>
                        <button
                          type="button"
                          onClick={() => setTab("profile")}
                          className="mt-1 text-caption font-semibold text-health-primary underline decoration-teal-200 underline-offset-4 hover:text-teal-800"
                        >
                          Заполнить антропометрию в профиле →
                        </button>
                      </div>
                    </div>
                  </DsCard>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                >
                  <DsCard hoverLift className="cursor-pointer" onClick={onOpenScoreDetail} role="button">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
                          Health Score
                        </p>
                        <p className="mt-1 text-body text-health-text-secondary">
                          Сводная оценка (демо) для выбранного члена семьи
                        </p>
                      </div>
                      <HealthScoreRing score={healthScore} label={scoreLabel} size={128} />
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <StatChip
                        icon={<MaterialIcon name="bedtime" className="text-[16px] text-health-primary" />}
                        label="Сон"
                        value="7,5 ч"
                      />
                      <StatChip
                        icon={<MaterialIcon name="footprint" className="text-[16px] text-health-primary" />}
                        label="Активность"
                        value="8 420 шагов"
                      />
                      <StatChip
                        icon={
                          <MaterialIcon name="local_fire_department" className="text-[16px] text-health-warning" />
                        }
                        label="Ккал"
                        value="1 850"
                        tone="warning"
                      />
                      <StatChip
                        icon={<MaterialIcon name="spa" className="text-[16px] text-health-secondary" />}
                        label="Стресс"
                        value="Низкий"
                        tone="positive"
                      />
                    </div>
                  </DsCard>
                </motion.div>

                {profiles.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <DsCard variant="muted">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <p className="text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
                            Семья
                          </p>
                          <p className="mt-0.5 text-sm text-health-text-secondary">
                            Средний балл:{" "}
                            <span className="font-semibold text-health-text">{familyAvg}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTab("profile")}
                          className="text-caption font-semibold text-health-primary hover:underline"
                        >
                          Управление →
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {profiles.map((p) => {
                          const active = p.id === activeProfileId;
                          const score = profileScore(p.id);
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
                                "group relative flex min-w-[6rem] flex-col items-center gap-1 rounded-2xl bg-health-surface px-2.5 pb-2 pt-2.5 text-center shadow-md shadow-slate-900/[0.05] ring-1 transition-all duration-300",
                                isAdmin ? "ring-amber-200/90" : "ring-health-border/70",
                                active && "ring-2 ring-health-primary ring-offset-2 ring-offset-health-bg",
                              )}
                            >
                              {isAdmin ? (
                                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-md ring-2 ring-white">
                                  <Crown size={11} strokeWidth={2.5} aria-hidden />
                                </span>
                              ) : null}
                              <ProfileAvatar
                                src={p.avatarUrl}
                                name={p.displayName}
                                size={44}
                                className="ring-2 ring-white shadow-sm"
                              />
                              <span className="max-w-[5rem] truncate text-center text-[11px] font-semibold text-health-text">
                                {p.displayName}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                  isAdmin ? "bg-amber-100 text-amber-950" : "bg-slate-100 text-slate-800",
                                )}
                              >
                                {isAdmin ? "Админ" : "Участник"}
                              </span>
                              <span className="text-[10px] font-medium tabular-nums text-health-text-secondary">
                                {score}/100
                              </span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setTab("profile")}
                          className="flex min-w-[6rem] flex-col items-center justify-center gap-1 rounded-2xl bg-slate-50/80 px-2 py-3 shadow-sm ring-1 ring-dashed ring-health-border/80 transition-all hover:bg-health-surface"
                        >
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-health-surface shadow-sm ring-1 ring-health-border/70">
                            <UserPlus size={20} strokeWidth={1.5} className="text-health-text-secondary" />
                          </div>
                          <span className="text-[10px] font-semibold text-health-text-secondary">Добавить</span>
                        </button>
                      </div>
                    </DsCard>
                  </motion.div>
                ) : null}

                <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTab("risks")}
                    className="rounded-2xl bg-health-surface p-4 text-left shadow-md shadow-slate-900/[0.05] ring-1 ring-health-border/80 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-caption font-bold uppercase tracking-wide text-health-text">
                        Риски и профилактика
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-health-text-secondary">
                        Обзор
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { icon: "cardiology" as const, label: "Сердце" },
                        { icon: "bloodtype" as const, label: "Метаболизм" },
                        { icon: "radiology" as const, label: "Скрининг" },
                      ].map((c) => (
                        <div
                          key={c.label}
                          className="rounded-xl bg-slate-50/90 p-2 text-center ring-1 ring-health-border/50"
                        >
                          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-health-surface text-health-primary shadow-sm">
                            <MaterialIcon name={c.icon} className="text-[18px]" />
                          </div>
                          <p className="mt-1 text-[10px] font-semibold text-health-text">{c.label}</p>
                        </div>
                      ))}
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={openDiary}
                      className="rounded-2xl bg-health-surface p-3 text-left shadow-md ring-1 ring-health-border/70 transition-all hover:shadow-lg"
                    >
                      <MaterialIcon name="hotel_class" className="text-[20px] text-indigo-600" filled />
                      <p className="mt-2 font-manrope text-xl font-bold tabular-nums text-health-text">7,2 ч</p>
                      <p className="text-[11px] font-medium text-health-text-secondary">Сон · дневник</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("analyses")}
                      className="rounded-2xl bg-health-surface p-3 text-left shadow-md ring-1 ring-health-border/70 transition-all hover:shadow-lg"
                    >
                      <MaterialIcon name="local_fire_department" className="text-[20px] text-orange-500" filled />
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-health-secondary to-health-primary" />
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-health-text-secondary">Ккал · цель</p>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden lg:col-span-4">
                <DsCard className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                  <div className="shrink-0 border-b border-health-border/60 bg-gradient-to-r from-teal-50/80 via-health-surface to-health-surface px-5 py-4">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h2 className="font-manrope text-h3 font-semibold text-health-text">Обследования</h2>
                        <p className="mt-0.5 text-caption text-health-text-secondary">
                          Недавние анализы · статусы и динамика
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setTab("trends")}
                          className="rounded-full bg-teal-50/95 px-4 py-1.5 text-caption font-semibold text-health-primary shadow-sm ring-1 ring-teal-100 transition-colors hover:bg-teal-100/80"
                        >
                          {t(lang, "home.trendsOpen")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab("analyses")}
                          className="rounded-full bg-health-primary px-4 py-1.5 text-caption font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
                        >
                          Все анализы
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden bg-health-bg/50 px-3 pb-3 pt-2 md:px-4">
                    {profiles.length > 0 ? (
                      <AnalysesPreview
                        profiles={profiles}
                        refreshKey={analysesRefreshKey}
                        onRequestUpload={() => setTab("analyses")}
                        compact
                        onOpenAnalyses={() => setTab("analyses")}
                      />
                    ) : (
                      <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl bg-health-surface/80 p-6 text-center text-body text-health-text-secondary shadow-inner ring-1 ring-health-border/60">
                        Добавьте профиль семьи
                      </div>
                    )}
                  </div>
                </DsCard>
              </div>

              <InsightsRail familyAvgScore={familyAvg} className="lg:col-span-3" />
            </div>
          ) : null}
        </div>
      </div>
      {sharedSheets}
    </>
  );
}
