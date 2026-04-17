"use client";

import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { Suspense, useCallback, useEffect, useState } from "react";
import { APP_NAME } from "@/constants";
import { SakbolMark } from "@/components/sakbol/sakbol-mark";
import { useTelegramSession } from "@/context/telegram-session-context";

function telegramAuthUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();
  if (!raw) return null;
  const u = raw.replace(/^@/, "");
  return `https://t.me/${u}?start=auth`;
}

function telegramBotUsername(): string {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ?? "";
}

function loginErrorMessage(code: string | null): string | null {
  switch (code) {
    case "no_profile":
      return "Аккаунт не найден. Сначала откройте мини-приложение в Telegram и завершите регистрацию (ПИН), затем войдите здесь снова.";
    case "telegram_widget":
      return "Не удалось подтвердить вход Telegram. Проверьте домен бота (/setdomain в BotFather) и попробуйте ещё раз.";
    case "server":
      return "Сервер временно недоступен. Попробуйте позже.";
    default:
      return code ? "Ошибка входа. Обновите страницу и попробуйте снова." : null;
  }
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authReady, isAuthenticated, refresh } = useTelegramSession();
  const [devBusy, setDevBusy] = useState(false);
  const [devErr, setDevErr] = useState<string | null>(null);
  const [widgetAuthUrl, setWidgetAuthUrl] = useState<string | null>(null);

  const tgUrl = telegramAuthUrl();
  const botUser = telegramBotUsername();
  const showDevLogin = process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true";
  const urlErr = searchParams.get("err");
  const bannerErr = loginErrorMessage(urlErr);

  useEffect(() => {
    setWidgetAuthUrl(`${window.location.origin}/api/auth/telegram-widget`);
  }, []);

  const tryDevLogin = useCallback(async () => {
    setDevErr(null);
    setDevBusy(true);
    try {
      const res = await fetch("/api/auth/dev", { method: "POST", credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDevErr(j.error ?? `Ката ${res.status}`);
        return;
      }
      refresh();
      router.replace("/");
    } finally {
      setDevBusy(false);
    }
  }, [refresh, router]);

  if (authReady && isAuthenticated) {
    return null;
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-white to-slate-100 px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-900/10"
      >
        <div className="flex flex-col items-center text-center">
          <SakbolMark size="lg" className="ring-[#004253]/20 shadow-md" />
          <h1 className="mt-4 font-manrope text-2xl font-extrabold text-[#004253]">{APP_NAME}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Кирүү үчүн Telegram аркылуу атыңызды ырастаңыз. Браузерде демо-профиль автоматтык түрдө
            ачылбайт.
          </p>
        </div>

        {bannerErr ? (
          <p
            className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-900"
            role="alert"
          >
            {bannerErr}
          </p>
        ) : null}

        <div className="mt-8 space-y-4 sakbol-web-cta-wrap">
          {botUser && widgetAuthUrl ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#229ED9]/35 bg-gradient-to-b from-[#229ED9]/[0.07] to-white p-4 shadow-sm">
              <p className="text-center text-sm font-semibold text-[#004253]">
                Вход в браузере
              </p>
              <p className="text-center text-[11px] leading-relaxed text-slate-600">
                Кирүү үчүн төмөнкү баскычты басыңыз — сиз ушул бетте калып, Telegram каттоосу аркылуу
                киресиз (келечекте колдонмо ачылбайт). / Нажмите кнопку ниже — вы останетесь на сайте.
              </p>
              <div className="flex min-h-[44px] w-full items-center justify-center [&_iframe]:rounded-xl">
                <Script
                  src="https://telegram.org/js/telegram-widget.js?22"
                  strategy="afterInteractive"
                  data-telegram-login={botUser}
                  data-size="large"
                  data-radius="12"
                  data-auth-url={widgetAuthUrl}
                  data-request-access="write"
                />
              </div>
            </div>
          ) : null}

          {tgUrl && botUser ? (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-center text-[11px] font-medium text-slate-500">
                Другие варианты / Башка жолдор
              </p>
              <a
                href={`https://web.telegram.org/k/#@${botUser}`}
                target="_blank"
                rel="noreferrer"
                className="flex w-full max-w-xs mx-auto items-center justify-center rounded-2xl border-2 border-[#229ED9] bg-white px-4 py-3 text-sm font-semibold text-[#229ED9] shadow-sm transition-colors hover:bg-[#229ED9]/5"
              >
                Telegram Web (браузер)
              </a>
              <motion.a
                href={tgUrl}
                target="_blank"
                rel="noreferrer"
                whileTap={{ scale: 0.98 }}
                className="flex w-full max-w-xs mx-auto items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
              >
                <Send className="h-5 w-5 shrink-0 text-[#229ED9]" strokeWidth={2} aria-hidden />
                Приложение Telegram / t.me
              </motion.a>
              <p className="text-center text-[10px] text-slate-400">
                Ссылка t.me часто открывает установленный Telegram, а не вкладку браузера.
              </p>
            </div>
          ) : !tgUrl ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
              Коюм: <code className="font-mono">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> (боттун
              аталышы, @сыз) — Vercel же .env.
            </p>
          ) : null}

          <p className="text-center text-[11px] text-slate-500">
            Мини-апп: ботто ачылгандан кийин сессия ушул браузерге жайгашат. Кирүү үчүн алгач жогорудагы
            виджетти колдонуңуз.
          </p>

          {showDevLogin ? (
            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={devBusy}
                onClick={() => void tryDevLogin()}
                className="w-full max-w-xs mx-auto rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                {devBusy ? "Кирүү…" : "Локалдуу dev-кирүү (ALLOW_DEV_LOGIN)"}
              </button>
              <p className="mt-2 text-center text-[10px] text-slate-400">
                Иштетүү үчүн серверде <code className="font-mono">ALLOW_DEV_LOGIN=true</code>.
              </p>
              {devErr ? (
                <p className="mt-2 text-center text-xs text-red-600" role="alert">
                  {devErr}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="pt-2 text-center text-[11px] text-slate-400">
            Кирүүсүз тиркемени колдонуу мүмкүн эмес.
          </p>
        </div>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-100 via-white to-slate-100">
          <p className="text-sm text-slate-500">Жүктөлүүдө…</p>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
