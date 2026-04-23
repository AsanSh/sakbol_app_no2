"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { WebOtpLoginForm } from "@/components/auth/web-otp-login-form";
import { useTelegramSession } from "@/context/telegram-session-context";

/**
 * Один экран входа: Telegram (код) + email/пароль. Mini App пусть ведёт на «/» — там
 * тот же провайдер поднимет initData. Здесь можно войти по email/коду из любого WebView.
 */
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
  const { authReady, isAuthenticated } = useTelegramSession();
  const urlErr = searchParams.get("err");
  const bannerErr = loginErrorMessage(urlErr);

  if (authReady && isAuthenticated) {
    return null;
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
