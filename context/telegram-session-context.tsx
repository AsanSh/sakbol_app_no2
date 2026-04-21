"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { hasTelegramWebAppBridge } from "@/lib/client-twa-detection";

export type TelegramViewer = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  familyRole: string;
  familyId: string;
  /** true — нужно ввести ПИН (миграция или первый вход без ПИН в теле запроса) */
  needsPinCompletion?: boolean;
};

export type TelegramSessionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unauthenticated"; reason?: string }
  | { status: "needs_new_user_pin" }
  | { status: "authenticated"; viewer: TelegramViewer };

type SubmitPinResult = { ok: true } | { ok: false; error: string };

type TelegramSessionContextValue = {
  state: TelegramSessionState;
  authReady: boolean;
  isAuthenticated: boolean;
  refresh: () => void;
  /** Подтянуть displayName/avatar из БД без полного re-login (после сохранения профиля). */
  syncViewerFromServer: () => Promise<void>;
  submitNewUserPin: (pin: string) => Promise<SubmitPinResult>;
};

const TelegramSessionContext = createContext<TelegramSessionContextValue | null>(null);

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Первый кадр в Telegram: initData может прийти чуть позже initDataUnsafe / hash. */
function looksLikeTelegramWebApp(WebApp: {
  initDataUnsafe?: { user?: unknown };
}): boolean {
  if (typeof window === "undefined") return false;
  if (WebApp.initDataUnsafe?.user != null) return true;
  return /tgWebAppData|tgWebAppVersion|tgWebAppPlatform/i.test(window.location.hash);
}

export function TelegramSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TelegramSessionState>({ status: "idle" });
  const [authReady, setAuthReady] = useState(false);
  const [tick, setTick] = useState(0);
  const pendingInitDataRef = useRef<string | null>(null);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const syncViewerFromServer = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as { profile: TelegramViewer };
      setState((prev) =>
        prev.status === "authenticated"
          ? { status: "authenticated", viewer: data.profile }
          : prev,
      );
    } catch {
      /* ignore */
    }
  }, []);

  const submitNewUserPin = useCallback(async (pin: string): Promise<SubmitPinResult> => {
    const initData = pendingInitDataRef.current;
    if (!initData) {
      return { ok: false, error: "Нет данных Telegram. Закройте и откройте мини-апп снова." };
    }
    const res = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ initData, pin }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      profile?: TelegramViewer;
    };
    if (!res.ok) {
      return { ok: false, error: j.error ?? `Ошибка ${res.status}` };
    }
    if (!j.profile) {
      return { ok: false, error: "Пустой ответ сервера." };
    }
    pendingInitDataRef.current = null;
    setState({ status: "authenticated", viewer: j.profile });
    return { ok: true };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      setState({ status: "loading" });
      setAuthReady(false);
      pendingInitDataRef.current = null;

      /** Обычный браузер (Chrome, Safari): без моста Telegram не трогаем SDK — только cookie-сессия. */
      if (typeof window !== "undefined" && !hasTelegramWebAppBridge()) {
        const sessionRes = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (cancelled) return;
        if (sessionRes.ok) {
          const data = (await sessionRes.json()) as { profile: TelegramViewer };
          setState({ status: "authenticated", viewer: data.profile });
          setAuthReady(true);
          return;
        }
        if (!cancelled) {
          setState({ status: "unauthenticated", reason: "web_login_required" });
          setAuthReady(true);
        }
        return;
      }

      type WebAppType = Awaited<typeof import("@twa-dev/sdk")>["default"];
      let WebApp: WebAppType | null = null;
      try {
        const mod = await import("@twa-dev/sdk");
        WebApp = mod.default;
        WebApp.ready();
      } catch {
        /* SDK / Telegram bridge not available */
      }

      let initData = "";
      if (WebApp) {
        initData = WebApp.initData ?? "";
        if (!initData && looksLikeTelegramWebApp(WebApp)) {
          for (let i = 0; i < 50; i++) {
            await sleep(50);
            if (cancelled) return;
            initData = WebApp.initData ?? "";
            if (initData) break;
          }
        }
      }

      const inTelegramMiniApp = WebApp ? looksLikeTelegramWebApp(WebApp) : false;

      if (!initData && !inTelegramMiniApp) {
        const sessionRes = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (cancelled) return;
        if (sessionRes.ok) {
          const data = (await sessionRes.json()) as { profile: TelegramViewer };
          setState({ status: "authenticated", viewer: data.profile });
          setAuthReady(true);
          return;
        }
        if (!cancelled) {
          setState({ status: "unauthenticated", reason: "web_login_required" });
          setAuthReady(true);
        }
        return;
      }

      if (!initData) {
        // Нет initData — пробуем cookie-сессию (email-логин внутри Telegram)
        const cookieRes = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (cancelled) return;
        if (cookieRes.ok) {
          const cookieData = (await cookieRes.json()) as { profile: TelegramViewer };
          setState({ status: "authenticated", viewer: cookieData.profile });
          setAuthReady(true);
          return;
        }
        if (!cancelled) {
          setState({
            status: "unauthenticated",
            reason: inTelegramMiniApp ? "telegram_init_data_missing" : "no_init_data",
          });
          setAuthReady(true);
        }
        return;
      }

      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ initData }),
      });

      if (cancelled) return;

      if (res.status === 400) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        if (j.code === "PIN_REQUIRED") {
          pendingInitDataRef.current = initData;
          setState({ status: "needs_new_user_pin" });
          setAuthReady(true);
          return;
        }
        // Telegram-auth не прошёл — проверяем cookie (email-логин)
        const cookieFallback = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (!cancelled && cookieFallback.ok) {
          const cookieData = (await cookieFallback.json()) as { profile: TelegramViewer };
          setState({ status: "authenticated", viewer: cookieData.profile });
          setAuthReady(true);
          return;
        }
        if (!cancelled) {
          setState({
            status: "unauthenticated",
            reason: j.error ?? res.statusText,
          });
          setAuthReady(true);
        }
        return;
      }

      if (!res.ok) {
        // Telegram-auth не прошёл — проверяем cookie (email-логин)
        const cookieFallback = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (!cancelled && cookieFallback.ok) {
          const cookieData = (await cookieFallback.json()) as { profile: TelegramViewer };
          setState({ status: "authenticated", viewer: cookieData.profile });
          setAuthReady(true);
          return;
        }
        if (!cancelled) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setState({
            status: "unauthenticated",
            reason: j.error ?? res.statusText,
          });
          setAuthReady(true);
        }
        return;
      }

      const data = (await res.json()) as { profile: TelegramViewer };
      setState({ status: "authenticated", viewer: data.profile });
      setAuthReady(true);
    }

    void authenticate();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const value = useMemo(
    () => ({
      state,
      authReady,
      isAuthenticated: state.status === "authenticated",
      refresh,
      syncViewerFromServer,
      submitNewUserPin,
    }),
    [state, authReady, refresh, syncViewerFromServer, submitNewUserPin],
  );

  return (
    <TelegramSessionContext.Provider value={value}>{children}</TelegramSessionContext.Provider>
  );
}

export function useTelegramSession() {
  const ctx = useContext(TelegramSessionContext);
  if (!ctx) {
    throw new Error("useTelegramSession must be used within TelegramSessionProvider");
  }
  return ctx;
}
