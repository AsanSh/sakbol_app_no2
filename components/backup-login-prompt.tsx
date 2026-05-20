"use client";

import { Mail, Phone, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTelegramSession } from "@/context/telegram-session-context";

const DISMISS_KEY = "sakbol_backup_login_dismissed";

type Tab = "email" | "phone";

type BackupStatus = {
  needsBackup: boolean;
};

/**
 * После входа предлагает привязать email или телефон для входа на сайте без Mini App.
 */
export function BackupLoginPrompt() {
  const pathname = usePathname();
  const { isAuthenticated, authReady } = useTelegramSession();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/profile/backup-login", { credentials: "include" });
      if (!r.ok) return;
      const j = (await r.json()) as BackupStatus;
      if (j.needsBackup && typeof window !== "undefined" && !localStorage.getItem(DISMISS_KEY)) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated) {
      setOpen(false);
      return;
    }
    if (pathname === "/login") return;
    void loadStatus();
  }, [authReady, isAuthenticated, pathname, loadStatus]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  const submitEmail = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/profile/link-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setErr(j.error ?? `Ошибка ${r.status}`);
        return;
      }
      setOpen(false);
      localStorage.removeItem(DISMISS_KEY);
    } finally {
      setBusy(false);
    }
  };

  const submitPhone = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/profile/web-login-phone", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setErr(j.error ?? `Ошибка ${r.status}`);
        return;
      }
      setOpen(false);
      localStorage.removeItem(DISMISS_KEY);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="relative w-full max-w-md rounded-3xl bg-white px-5 pb-5 pt-8 shadow-xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50">
          <Mail className="h-7 w-7 text-[#229ED9]" aria-hidden />
        </div>

        <h2 className="mt-3 text-center font-manrope text-lg font-bold text-[#004253]">
          {tab === "email" ? "Привяжите email" : "Привяжите телефон"}
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
          {tab === "email"
            ? "Если Telegram будет недоступен, вы сможете войти на сайт по email и паролю."
            : "Укажите номер из Telegram — на странице входа получите код от бота."}
        </p>

        <div className="mt-4 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setTab("email");
              setErr(null);
            }}
            className={tab === "email" ? tabActive : tabIdle}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("phone");
              setErr(null);
            }}
            className={tab === "phone" ? tabActive : tabIdle}
          >
            Телефон
          </button>
        </div>

        {tab === "email" ? (
          <div className="mt-4 space-y-3">
            <input
              type="email"
              autoComplete="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className={inputCls}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Пароль (от 8 символов)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className={inputCls}
            />
            <button
              type="button"
              disabled={busy || !email.trim() || password.length < 8}
              onClick={() => void submitEmail()}
              className={primaryBtn}
            >
              {busy ? "…" : "Сохранить"}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+996 555 12 34 56"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
              className={inputCls}
            />
            <button
              type="button"
              disabled={busy || !phone.trim()}
              onClick={() => void submitPhone()}
              className={primaryBtn}
            >
              {busy ? "…" : "Сохранить номер"}
            </button>
            <p className="text-center text-[10px] leading-relaxed text-slate-500">
              <Phone className="mr-0.5 inline h-3 w-3" aria-hidden />
              На{" "}
              <a href="/login" className="font-medium text-[#229ED9] underline">
                странице входа
              </a>{" "}
              выберите «Telegram» и введите этот номер.
            </p>
          </div>
        )}

        {err ? (
          <p className="mt-3 text-center text-xs text-red-600" role="alert">
            {err}
          </p>
        ) : null}

        <button
          type="button"
          onClick={dismiss}
          className="mt-4 w-full py-2 text-center text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Позже
        </button>
      </div>
    </div>
  );
}

const tabActive = "flex-1 rounded-lg bg-white py-2 text-[#004253] shadow-sm";
const tabIdle = "flex-1 rounded-lg py-2 text-slate-600";
const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#229ED9]";
const primaryBtn =
  "w-full rounded-2xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50";
