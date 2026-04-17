"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  HeartPulse,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { SakbolMark } from "@/components/sakbol/sakbol-mark";
import { APP_NAME } from "@/constants";
import { cn } from "@/lib/utils";

function telegramBotUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();
  if (!raw) return null;
  return `https://t.me/${raw.replace(/^@/, "")}`;
}

const FEATURES = [
  {
    icon: HeartPulse,
    title: "Анализы в одном месте",
    text: "Загружайте PDF и фото расшифровок, храните историю и смотрите статусы относительно референсов.",
  },
  {
    icon: Users,
    title: "Семейный аккаунт",
    text: "Несколько профилей — дети, родители, супруг. Переключайте активного члена семьи для загрузки и просмотра.",
  },
  {
    icon: TrendingUp,
    title: "Динамика показателей",
    text: "Сравнивайте анализы во времени и отслеживайте изменения ключевых маркеров.",
  },
  {
    icon: Bot,
    title: "Помощник по документам",
    text: "Задавайте вопросы простым языком с опорой на ваши загруженные данные. Это не диагноз и не замена врачу.",
  },
];

export function SakbolLanding() {
  const tg = telegramBotUrl();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-health-bg via-teal-50/30 to-health-bg">
      <header className="sticky top-0 z-30 border-b border-health-border/70 bg-health-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <SakbolMark size="md" />
            <div className="min-w-0">
              <p className="font-manrope text-base font-bold tracking-tight text-health-text">{APP_NAME}</p>
              <p className="truncate text-[10px] font-medium text-health-text-secondary">
                Медицинские данные семьи
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="shrink-0 rounded-full bg-health-primary px-4 py-2 text-caption font-semibold text-white shadow-md shadow-teal-900/15 transition-colors hover:bg-teal-700"
          >
            Войти
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <p className="text-caption font-semibold uppercase tracking-wider text-health-primary">
            Кыргызстан · семейное здоровье
          </p>
          <h1 className="mt-3 font-manrope text-2xl font-bold leading-tight tracking-tight text-health-text sm:text-3xl">
            Понятный сервис для анализов и динамики показателей всей семьи
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-body leading-relaxed text-health-text-secondary">
            {APP_NAME} — веб-платформа и мини-приложение в Telegram: загрузка расшифровок, хранение истории,
            переключение профилей и ориентиры по показателям. Удобно зайти с телефона или компьютера после
            регистрации.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-health-primary px-6 py-3 text-caption font-semibold text-white shadow-lg shadow-teal-900/20 transition-colors hover:bg-teal-700"
            >
              Войти или зарегистрироваться
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </Link>
            {tg ? (
              <a
                href={tg}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border-2 border-health-border bg-health-surface px-6 py-3 text-caption font-semibold text-health-text shadow-sm transition-colors hover:bg-teal-50/80"
              >
                Открыть бота в Telegram
              </a>
            ) : null}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="mt-14"
        >
          <h2 className="text-center font-manrope text-lg font-bold text-health-text sm:text-xl">
            Что вы получаете
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className={cn(
                  "rounded-2xl border border-health-border/80 bg-health-surface/95 p-4 shadow-sm shadow-slate-900/[0.04]",
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-health-primary">
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </div>
                <p className="mt-3 font-manrope text-sm font-bold text-health-text">{title}</p>
                <p className="mt-1.5 text-caption leading-relaxed text-health-text-secondary">{text}</p>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="mt-12 rounded-2xl border border-health-border/80 bg-gradient-to-br from-teal-50/80 to-health-surface p-5 shadow-sm sm:p-6"
        >
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-health-primary shadow-sm ring-1 ring-health-border/60">
              <Activity className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <h3 className="font-manrope text-sm font-bold text-health-text">Платформа</h3>
              <p className="mt-2 text-caption leading-relaxed text-health-text-secondary">
                Работает в браузере и как Telegram Mini App: одна учётная запись, синхронизация профилей и
                анализов. Вход с сайта — через безопасный виджет Telegram; в мини-приложении — через ваш
                аккаунт в Telegram.
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="mt-10 flex gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 text-amber-950"
        >
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" strokeWidth={2} aria-hidden />
          <div>
            <p className="text-sm font-semibold">Важно</p>
            <p className="mt-1 text-caption leading-relaxed text-amber-900/90">
              {APP_NAME} не ставит диагнозы и не заменяет очный приём врача. Решения о лечении принимайте
              только со специалистом. Персональные данные обрабатываются для работы сервиса; ПИН/ИНН не
              хранится в открытом виде.
            </p>
          </div>
        </motion.section>

        <p className="mt-10 text-center text-[10px] text-health-text-secondary">
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </main>
    </div>
  );
}
