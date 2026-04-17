"use client";

import { useSyncExternalStore } from "react";
import { SakbolLanding } from "@/components/sakbol/sakbol-landing";
import { SakbolMainClient } from "@/components/sakbol/sakbol-main-client";
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
 * Главная «/»: для гостя — посадочная с описанием сервиса; после входа — полное приложение.
 * Сценарии ПИН и ожидание initData в TWA сохраняем через основной клиент.
 */
export function HomeEntry() {
  const { authReady, isAuthenticated, state } = useTelegramSession();
  const looksLikeTwa = useHydratedLooksLikeTwa();

  if (!authReady) {
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

  if (state.status === "unauthenticated" && state.reason === "telegram_init_data_missing") {
    if (!looksLikeTwa) {
      return <SakbolLanding />;
    }
    return <SakbolMainClient />;
  }

  return <SakbolLanding />;
}
