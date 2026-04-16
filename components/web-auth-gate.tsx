"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTelegramSession } from "@/context/telegram-session-context";

function AuthBlockingShell() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-800/30 border-t-emerald-800"
        aria-hidden
      />
    </div>
  );
}

/**
 * В обычном браузере без сессии не показываем приложение — только /login.
 * Telegram Mini App и публичные маршруты (/share) не затрагиваются.
 */
export function WebAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { authReady, isAuthenticated, state } = useTelegramSession();

  const isPublic = pathname === "/login" || pathname.startsWith("/share/");

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (pathname === "/login") {
      router.replace("/");
    }
  }, [authReady, isAuthenticated, pathname, router]);

  useEffect(() => {
    if (!authReady || isPublic) return;
    if (!isAuthenticated && state.status === "unauthenticated") {
      if (state.reason === "telegram_init_data_missing") return;
      router.replace("/login");
    }
  }, [authReady, isPublic, isAuthenticated, router, state]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (!authReady) {
    return <AuthBlockingShell />;
  }

  if (!isAuthenticated) {
    if (state.status === "unauthenticated" && state.reason === "telegram_init_data_missing") {
      return <>{children}</>;
    }
    if (state.status === "needs_new_user_pin") {
      return <>{children}</>;
    }
    return <AuthBlockingShell />;
  }

  return <>{children}</>;
}
