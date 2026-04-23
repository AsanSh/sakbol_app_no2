"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import { WebOtpLoginForm } from "@/components/auth/web-otp-login-form";
import { useTelegramSession } from "@/context/telegram-session-context";
import { clientLooksLikeTelegramWebApp } from "@/lib/client-twa-detection";
import { telegramBotUsernameFromEnv } from "@/lib/telegram-public-urls";

function subscribeNoop() {
  return () => {};
}

function serverSnapshotNoTwa() {
  return false;
}

function useHydratedLooksLikeTwa() {
  return useSyncExternalStore(
    subscribeNoop,
    () => clientLooksLikeTelegramWebApp(),
    serverSnapshotNoTwa,
  );
}

function loginErrorMessage(code: string | null): string | null {
  switch (code) {
    case "no_profile":
      return "Аккаунт не найден. Сначала зарегистрируйтесь в мини-приложении бота (ПИН), затем войдите на сайте по коду из Telegram.";
    case "telegram_widget":
      return "Старый способ входа (виджет) не сработал. Используйте код из Telegram на этой странице.";
    case "server":
      return "Сервер временно недоступен. Попробуйте позже.";
    default:
      return code ? "Ошибка входа. Обновите страницу и попробуйте снова." : null;
  }
}

/**
 * /login внутри Telegram Mini App: форма с email и паролем не показывается — вход
 * идёт автоматически по initData (см. TelegramSessionProvider). ПИН/ошибки — в приложении.
 */
function LoginTelegramMiniAppView() {
  const router = useRouter();
  const { authReady, isAuthenticated, state } = useTelegramSession();

  useEffect(() => {
    if (authReady && state.status === "needs_new_user_pin") {
      router.replace("/");
    }
  }, [authReady, state.status, router]);

  if (!authReady || state.status === "loading") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-6">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-teal-600/30 border-t-teal-600"
          aria-hidden
        />
        <p className="mt-4 text-center text-sm text-slate-600">Вход через Telegram…</p>
      </main>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  if (state.status === "needs_new_user_pin") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-6">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-teal-600/30 border-t-teal-600"
          aria-hidden
        />
        <p className="mt-4 text-center text-sm text-slate-600">Открываем приложение…</p>
      </main>
    );
  }

  if (state.status === "unauthenticated" && state.reason === "telegram_init_data_missing") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-6 py-12">
        <div className="max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm text-amber-950">
          <p className="font-semibold">Нет подписи от Telegram</p>
          <p className="mt-2 text-xs leading-relaxed">
            Закройте мини-приложение и откройте снова из чата с ботом — тогда вход выполнится
            автоматически, без email и кода.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-6 py-12">
      <div className="max-w-sm rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-center text-sm text-rose-950">
        <p className="font-semibold">Не удалось войти</p>
        <p className="mt-2 text-xs leading-relaxed">
          {state.status === "unauthenticated" && state.reason
            ? state.reason
            : "Обновите страницу или откройте SakBol в обычном браузере — там можно войти по email или коду из Telegram."}
        </p>
      </div>
    </main>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const looksLikeTwa = useHydratedLooksLikeTwa();
  const { authReady, isAuthenticated } = useTelegramSession();
  const botUser = telegramBotUsernameFromEnv();

  const urlErr = searchParams.get("err");
  const bannerErr = loginErrorMessage(urlErr);

  if (authReady && isAuthenticated) {
    return null;
  }

  if (looksLikeTwa) {
    if (!botUser) {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-6 py-12">
          <div className="max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm text-amber-950">
            <p className="font-semibold">Конфигурация</p>
            <p className="mt-2 text-xs leading-relaxed">
              На сервере не задан бот (
              <code className="font-mono">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>). Для
              проверки откройте сайт в обычном браузере.
            </p>
          </div>
        </main>
      );
    }
    return <LoginTelegramMiniAppView />;
  }

  return <WebOtpLoginForm urlBannerError={bannerErr} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-100 via-white to-slate-100">
          <p className="text-sm text-slate-500">Загрузка…</p>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
