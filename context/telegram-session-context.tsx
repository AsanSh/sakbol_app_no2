"use client";

/**
 * Единая сессия SakBol (веб: cookie; Telegram Mini App: initData + тот же cookie).
 * Схема: 1) всегда GET /api/auth/session; 2) при отсутствии сессии в Telegram — initData.
 */
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
  syncViewerFromServer: () => Promise<void>;
  submitNewUserPin: (pin: string) => Promise<SubmitPinResult>;
  signOut: () => Promise<void>;
};

const TelegramSessionContext = createContext<TelegramSessionContextValue | null>(null);

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

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

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      /* ignore */
    }
    pendingInitDataRef.current = null;
    setState({ status: "unauthenticated", reason: "signed_out" });
    setAuthReady(true);
    if (typeof window !== "undefined") {
      window.location.assign("/login");
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("sakbol:session-updated"));
    }
    return { ok: true };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSessionFromCookie(): Promise<TelegramViewer | null> {
      const res = await fetch("/api/auth/session", { credentials: "same-origin" });
      if (!res.ok) return null;
      const data = (await res.json()) as { profile: TelegramViewer };
      return data.profile;
    }

    async function authenticate() {
      setState({ status: "loading" });
      setAuthReady(false);
      pendingInitDataRef.current = null;

      if (typeof window === "undefined") {
        if (!cancelled) setAuthReady(true);
        return;
      }

      const fromCookie = await loadSessionFromCookie();
      if (cancelled) return;
      if (fromCookie) {
        setState({ status: "authenticated", viewer: fromCookie });
        setAuthReady(true);
        return;
      }

      if (!hasTelegramWebAppBridge()) {
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
        /* no SDK */
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
        const again = await loadSessionFromCookie();
        if (cancelled) return;
        if (again) {
          setState({ status: "authenticated", viewer: again });
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
        const again = await loadSessionFromCookie();
        if (cancelled) return;
        if (again) {
          setState({ status: "authenticated", viewer: again });
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
        const fb = await loadSessionFromCookie();
        if (!cancelled && fb) {
          setState({ status: "authenticated", viewer: fb });
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
        const fb = await loadSessionFromCookie();
        if (!cancelled && fb) {
          setState({ status: "authenticated", viewer: fb });
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
      signOut,
    }),
    [state, authReady, refresh, syncViewerFromServer, submitNewUserPin, signOut],
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
