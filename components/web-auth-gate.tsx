"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTelegramSession } from "@/context/telegram-session-context";
import { safePostLoginPath } from "@/lib/safe-redirect";

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
 * Telegram Mini App и публичные маршруты (/share, /share-profile) не затрагиваются.
 */
export function WebAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authReady, isAuthenticated, state } = useTelegramSession();

  const isPublic =
    pathname === "/login" ||
    pathname === "/" ||
    pathname === "/join-family" ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/share-profile/");

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (pathname === "/login") {
      router.replace(safePostLoginPath(searchParams.get("next")));
    }
  }, [authReady, isAuthenticated, pathname, router, searchParams]);

  useEffect(() => {
    if (!authReady || isPublic) return;
    if (isAuthenticated) return;
    // Telegram Mini App ошибки/PIN-кейсы решаются на уровне HomeEntry, а не редиректами.
    if (state.status === "needs_new_user_pin") return;
    if (state.status === "error") return;
    if (state.status === "unauthenticated") {
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
    if (state.status === "needs_new_user_pin") return <>{children}</>;
    if (state.status === "error") {
      // На внутренних страницах при ошибке Mini App auth — отправляем на «/», там HomeEntry покажет диагностику с retry.
      if (typeof window !== "undefined") router.replace("/");
      return <AuthBlockingShell />;
    }
    return <AuthBlockingShell />;
  }

  return <>{children}</>;
}
