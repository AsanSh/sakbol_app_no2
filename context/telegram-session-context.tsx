"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TelegramViewer = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  familyRole: string;
  familyId: string;
};

type TelegramSessionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unauthenticated"; reason?: string }
  | { status: "authenticated"; viewer: TelegramViewer };

type TelegramSessionContextValue = {
  state: TelegramSessionState;
  authReady: boolean;
  isAuthenticated: boolean;
  refresh: () => void;
};

const TelegramSessionContext = createContext<TelegramSessionContextValue | null>(null);

export function TelegramSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TelegramSessionState>({ status: "idle" });
  const [authReady, setAuthReady] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      setState({ status: "loading" });

      let initData = "";
      try {
        const { default: WebApp } = await import("@twa-dev/sdk");
        initData = WebApp.initData ?? "";
      } catch {
        /* not in Telegram */
      }

      if (!initData && process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true") {
        const devRes = await fetch("/api/auth/dev", { method: "POST" });
        if (cancelled) return;
        if (devRes.ok) {
          const data = (await devRes.json()) as { profile: TelegramViewer };
          setState({ status: "authenticated", viewer: data.profile });
          setAuthReady(true);
          return;
        }
        const errBody = (await devRes.json().catch(() => ({}))) as { error?: string };
        if (!cancelled) {
          setState({
            status: "unauthenticated",
            reason: errBody.error ?? `dev_login_${devRes.status}`,
          });
          setAuthReady(true);
        }
        return;
      }

      if (!initData) {
        if (!cancelled) {
          setState({
            status: "unauthenticated",
            reason: "no_init_data",
          });
          setAuthReady(true);
        }
        return;
      }

      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      if (cancelled) return;

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setState({
          status: "unauthenticated",
          reason: j.error ?? res.statusText,
        });
        setAuthReady(true);
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
    }),
    [state, authReady, refresh],
  );

  return (
    <TelegramSessionContext.Provider value={value}>
      {children}
    </TelegramSessionContext.Provider>
  );
}

export function useTelegramSession() {
  const ctx = useContext(TelegramSessionContext);
  if (!ctx) {
    throw new Error("useTelegramSession must be used within TelegramSessionProvider");
  }
  return ctx;
}
