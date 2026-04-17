"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";
import { LoginTelegramClientPanel } from "@/components/auth/login-telegram-client-panel";
import { WebOtpLoginForm } from "@/components/auth/web-otp-login-form";
import { useTelegramSession } from "@/context/telegram-session-context";
import { hasTelegramWebAppBridge } from "@/lib/client-twa-detection";
import {
  telegramBotUsernameFromEnv,
  telegramMiniAppStartUrlFromEnv,
} from "@/lib/telegram-public-urls";

function subscribeNoop() {
  return () => {};
}

function snapshotHasTelegramBridge() {
  return hasTelegramWebAppBridge();
}

function serverSnapshotNoTelegram() {
  return false;
}

function useTelegramBridgePresent() {
  return useSyncExternalStore(subscribeNoop, snapshotHasTelegramBridge, serverSnapshotNoTelegram);
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

function LoginPageContent() {
  const searchParams = useSearchParams();
  const inTelegramClient = useTelegramBridgePresent();
  const { authReady, isAuthenticated } = useTelegramSession();

  const miniAppUrl = telegramMiniAppStartUrlFromEnv();
  const botUser = telegramBotUsernameFromEnv();
  const urlErr = searchParams.get("err");
  const bannerErr = loginErrorMessage(urlErr);

  if (authReady && isAuthenticated) {
    return null;
  }

  if (inTelegramClient) {
    if (miniAppUrl && botUser) {
      return <LoginTelegramClientPanel botUser={botUser} miniAppUrl={miniAppUrl} />;
    }
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-6 py-12">
        <div className="max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm text-amber-950">
          <p className="font-semibold">Открыто внутри Telegram</p>
          <p className="mt-2 text-xs leading-relaxed">
            На сервере не задан бот (<code className="font-mono">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>
            ). Откройте сайт в обычном браузере или настройте переменную.
          </p>
        </div>
      </main>
    );
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
