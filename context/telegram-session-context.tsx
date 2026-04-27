"use client";

/**
 * Единая сессия SakBol.
 * - Веб (без Telegram WebApp): cookie-сессия (/api/auth/session).
 * - Telegram Mini App: всегда отправляем initData → /api/auth/telegram (там же и share-токен).
 *
 * Состояния: idle → loading → (authenticated | needs_new_user_pin | error | unauthenticated).
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
import {
  clientLooksLikeTelegramWebApp,
  hasTelegramWebAppBridge,
} from "@/lib/client-twa-detection";

export type TelegramViewer = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  familyRole: string;
  familyId: string;
  needsPinCompletion?: boolean;
};

/** `error` — Mini App-специфичный сбой (нет initData, плохая подпись, упал сервер). */
export type TelegramSessionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unauthenticated"; reason?: string }
  | { status: "needs_new_user_pin" }
  | { status: "error"; reason: string; canRetry: boolean }
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

const INIT_DATA_RETRY_TICKS = 60; // 60 × 50 мс = 3 с
const INIT_DATA_RETRY_DELAY = 50;

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

/**
 * Применить ВСЕ ожидающие совместные доступы для текущего Telegram-юзера.
 *
 * Сервер сам разберётся: если в start_param есть share-токен — обработает; в любом
 * случае все pendingTelegramUserId, привязанные к этому Telegram ID, найдут свой профиль
 * и станут видимыми в /api/family/default. Идемпотентно — можно дёргать сколько угодно раз.
 */
async function applyShareFromInitDataIfPresent(initData: string): Promise<boolean> {
  if (!initData) return false;
  try {
    const res = await fetch("/api/profile/access/apply-from-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) {
      console.warn("[telegram session] apply-from-init failed", res.status);
      return false;
    }
    const j = (await res.json().catch(() => ({}))) as { appliedPendingCount?: number };
    if ((j.appliedPendingCount ?? 0) > 0) {
      console.log("[telegram session] applied pending shared invites", j.appliedPendingCount);
    }
    return true;
  } catch (e) {
    console.warn("[telegram session] apply-from-init error", e);
    return false;
  }
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
    let res: Response;
    try {
      res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ initData, pin }),
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Сеть недоступна." };
    }
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
    await applyShareFromInitDataIfPresent(initData);
    setState({ status: "authenticated", viewer: j.profile });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("sakbol:session-updated"));
    }
    return { ok: true };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSessionFromCookie(): Promise<TelegramViewer | null> {
      try {
        const res = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (!res.ok) return null;
        const data = (await res.json()) as { profile: TelegramViewer };
        return data.profile;
      } catch {
        return null;
      }
    }

    async function readWebAppInitData(): Promise<{
      WebApp: unknown;
      initData: string;
      inMiniApp: boolean;
    }> {
      type WebAppType = Awaited<typeof import("@twa-dev/sdk")>["default"];
      let WebApp: WebAppType | null = null;
      try {
        const mod = await import("@twa-dev/sdk");
        WebApp = mod.default;
        WebApp.ready();
      } catch {
        return { WebApp: null, initData: "", inMiniApp: false };
      }

      let initData = WebApp.initData ?? "";
      const inMiniApp = looksLikeTelegramWebApp(WebApp);
      if (!initData && inMiniApp) {
        for (let i = 0; i < INIT_DATA_RETRY_TICKS; i++) {
          await sleep(INIT_DATA_RETRY_DELAY);
          if (cancelled) break;
          initData = WebApp.initData ?? "";
          if (initData) break;
        }
      }
      return { WebApp, initData, inMiniApp };
    }

    async function authenticate() {
      setState({ status: "loading" });
      setAuthReady(false);
      pendingInitDataRef.current = null;

      if (typeof window === "undefined") {
        if (!cancelled) setAuthReady(true);
        return;
      }

      // Детект TWA на двух уровнях:
      //   - hash в URL (`tgWebAppData=...`) Telegram ставит ДО загрузки SDK — самый ранний сигнал;
      //   - window.Telegram.WebApp может появиться позже (через telegram-web-app.js или @twa-dev/sdk).
      // Если хоть один сигнал положительный — идём по TWA-ветке и ждём initData.
      const looksLikeTwaSync =
        clientLooksLikeTelegramWebApp() || hasTelegramWebAppBridge();

      // 1) Обычный браузер: только cookie.
      if (!looksLikeTwaSync) {
        const fromCookie = await loadSessionFromCookie();
        if (cancelled) return;
        if (fromCookie) {
          setState({ status: "authenticated", viewer: fromCookie });
        } else {
          setState({ status: "unauthenticated", reason: "web_login_required" });
        }
        setAuthReady(true);
        return;
      }

      // 2) Telegram Mini App: ждём initData до 3 с, затем шлём на сервер.
      const { initData, inMiniApp } = await readWebAppInitData();
      if (cancelled) return;

      if (!initData) {
        // initData нет вообще — может, обычный браузер с расширением Telegram WebApp,
        // но не сам Mini App. Пробуем cookie.
        const fromCookie = await loadSessionFromCookie();
        if (cancelled) return;
        if (fromCookie) {
          setState({ status: "authenticated", viewer: fromCookie });
          setAuthReady(true);
          return;
        }
        if (inMiniApp) {
          setState({
            status: "error",
            reason:
              "Telegram не передал данные. Перезапустите мини-приложение (закройте и откройте снова через бота).",
            canRetry: true,
          });
        } else {
          setState({ status: "unauthenticated", reason: "web_login_required" });
        }
        setAuthReady(true);
        return;
      }

      // 3) initData есть — авторизуемся.
      let res: Response;
      try {
        res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ initData }),
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          reason:
            e instanceof Error ? `Сеть: ${e.message}` : "Не удалось связаться с сервером.",
          canRetry: true,
        });
        setAuthReady(true);
        return;
      }
      if (cancelled) return;

      // PIN_REQUIRED → отдельная форма ниже.
      if (res.status === 400) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (j.code === "PIN_REQUIRED") {
          pendingInitDataRef.current = initData;
          setState({ status: "needs_new_user_pin" });
          setAuthReady(true);
          return;
        }
        // Иной 400: пытаемся cookie, потом ошибка
        const fb = await loadSessionFromCookie();
        if (cancelled) return;
        if (fb) {
          await applyShareFromInitDataIfPresent(initData);
          setState({ status: "authenticated", viewer: fb });
          window.dispatchEvent(new Event("sakbol:session-updated"));
          setAuthReady(true);
          return;
        }
        setState({
          status: "error",
          reason: j.error ?? "Сервер отклонил данные Telegram.",
          canRetry: true,
        });
        setAuthReady(true);
        return;
      }

      if (!res.ok) {
        // 401 (плохая подпись), 503 (нет TELEGRAM_BOT_TOKEN), 5xx — это сбой настройки.
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        const fb = await loadSessionFromCookie();
        if (cancelled) return;
        if (fb) {
          await applyShareFromInitDataIfPresent(initData);
          setState({ status: "authenticated", viewer: fb });
          window.dispatchEvent(new Event("sakbol:session-updated"));
          setAuthReady(true);
          return;
        }
        setState({
          status: "error",
          reason: j.error ?? `Сервер вернул ${res.status}.`,
          canRetry: true,
        });
        setAuthReady(true);
        return;
      }

      const data = (await res.json()) as { profile: TelegramViewer };
      // Дублирующий проход на случай, если share-токен в start_param не был обработан в основном auth-роуте.
      await applyShareFromInitDataIfPresent(initData);
      setState({ status: "authenticated", viewer: data.profile });
      window.dispatchEvent(new Event("sakbol:session-updated"));
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
