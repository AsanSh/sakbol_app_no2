"use client";

import { useSyncExternalStore } from "react";
import { SakbolLanding } from "@/components/sakbol/sakbol-landing";
import { SakbolMainClient } from "@/components/sakbol/sakbol-main-client";
import { SakbolTwaErrorScreen } from "@/components/sakbol/sakbol-twa-error";
import { useTelegramSession } from "@/context/telegram-session-context";
import { clientLooksLikeTelegramWebApp } from "@/lib/client-twa-detection";

function subscribeNoop() {
  return () => {};
}

function snapshotLooksLikeTwa() {
  return clientLooksLikeTelegramWebApp();
}

function serverSnapshotTwa() {
  return false;
}

function useHydratedLooksLikeTwa() {
  return useSyncExternalStore(subscribeNoop, snapshotLooksLikeTwa, serverSnapshotTwa);
}

/**
 * Главная «/». Логика проста:
 *   - В обычном браузере: гость → SakbolLanding; вошёл → SakbolMainClient.
 *   - В Telegram Mini App: пока грузится — спиннер; ПИН — main client (там модал TelegramPinGates);
 *     ошибка — экран ошибки с retry; вошёл — main client. Landing в TWA НЕ показываем никогда.
 */
export function HomeEntry() {
  const { authReady, isAuthenticated, state } = useTelegramSession();
  const looksLikeTwa = useHydratedLooksLikeTwa();

  if (!authReady || state.status === "loading" || state.status === "idle") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-health-bg">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-health-primary/30 border-t-health-primary"
          aria-hidden
        />
      </div>
    );
  }

  if (state.status === "needs_new_user_pin") {
    return <SakbolMainClient />;
  }

  if (isAuthenticated) {
    return <SakbolMainClient />;
  }

  if (state.status === "error") {
    if (looksLikeTwa) {
      return <SakbolTwaErrorScreen reason={state.reason} />;
    }
    // В браузере «error» = ошибка серверной интеграции → ведём на /login через landing.
    return <SakbolLanding />;
  }

  // unauthenticated в TWA: тоже даём диагностику, не landing.
  if (looksLikeTwa) {
    const reason =
      state.status === "unauthenticated" && state.reason
        ? state.reason
        : "Не удалось войти. Откройте мини-приложение заново.";
    return <SakbolTwaErrorScreen reason={reason} />;
  }

  return <SakbolLanding />;
}
