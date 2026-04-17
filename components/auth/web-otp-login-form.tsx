"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SakbolMark } from "@/components/sakbol/sakbol-mark";
import { APP_NAME } from "@/constants";
import { useTelegramSession } from "@/context/telegram-session-context";

type Props = {
  urlBannerError?: string | null;
};

export function WebOtpLoginForm({ urlBannerError }: Props) {
  const router = useRouter();
  const { refresh } = useTelegramSession();
  const [telegram, setTelegram] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"request" | "verify" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);
  const [devErr, setDevErr] = useState<string | null>(null);
  const showDevLogin = process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true";

  const requestCode = useCallback(async () => {
    setErr(null);
    setBusy("request");
    try {
      const res = await fetch("/api/auth/web-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram: telegram.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        challengeId?: string;
      };
      if (!res.ok) {
        setErr(j.error ?? `Ошибка ${res.status}`);
        return;
      }
      if (!j.challengeId) {
        setErr("Пустой ответ сервера.");
        return;
      }
      setChallengeId(j.challengeId);
      setCode("");
    } finally {
      setBusy(null);
    }
  }, [telegram]);

  const tryDevLogin = useCallback(async () => {
    setDevErr(null);
    setDevBusy(true);
    try {
      const res = await fetch("/api/auth/dev", { method: "POST", credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDevErr(j.error ?? `Ошибка ${res.status}`);
        return;
      }
      refresh();
      router.replace("/");
    } finally {
      setDevBusy(false);
    }
  }, [refresh, router]);

  const verifyCode = useCallback(async () => {
    if (!challengeId) return;
    setErr(null);
    setBusy("verify");
    try {
      const res = await fetch("/api/auth/web-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ challengeId, code: code.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? `Ошибка ${res.status}`);
        return;
      }
      refresh();
      router.replace("/");
    } finally {
      setBusy(null);
    }
  }, [challengeId, code, refresh, router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-white to-slate-100 px-6 py-12">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-900/10"
    >
      <div className="flex flex-col items-center text-center">
        <SakbolMark size="lg" className="ring-[#004253]/20 shadow-md" />
        <h1 className="mt-4 font-manrope text-2xl font-extrabold text-[#004253]">{APP_NAME}</h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-teal-800/90">
          Вход с сайта
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Введите ваш Telegram (@username или числовой id). Одноразовый код придёт в чат с ботом — откройте
          бота и нажмите <span className="font-medium">Start</span>, если ещё не нажимали.
        </p>
      </div>

      {urlBannerError ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-950" role="status">
          {urlBannerError}
        </p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-900" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        <label className="block text-left text-xs font-medium text-slate-600">
          Telegram
          <input
            type="text"
            name="telegram"
            autoComplete="username"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            disabled={Boolean(challengeId)}
            placeholder="@username или id"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-[#229ED9] disabled:bg-slate-50"
          />
        </label>

        {!challengeId ? (
          <button
            type="button"
            disabled={busy !== null || !telegram.trim()}
            onClick={() => void requestCode()}
            className="w-full rounded-2xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1e8bc7] disabled:opacity-50"
          >
            {busy === "request" ? "Отправка…" : "Получить код в Telegram"}
          </button>
        ) : (
          <>
            <p className="text-center text-[11px] text-slate-600">
              Код отправлен. Проверьте сообщение от бота (действует 10 минут).
            </p>
            <label className="block text-left text-xs font-medium text-slate-600">
              Код из Telegram
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-slate-900 outline-none focus:border-[#229ED9]"
              />
            </label>
            <button
              type="button"
              disabled={busy !== null || code.length !== 6}
              onClick={() => void verifyCode()}
              className="w-full rounded-2xl bg-[#004253] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#003845] disabled:opacity-50"
            >
              {busy === "verify" ? "Вход…" : "Войти"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setChallengeId(null);
                setCode("");
                setErr(null);
              }}
              className="w-full text-center text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
            >
              Другой Telegram / новый код (не чаще раза в минуту)
            </button>
          </>
        )}

        {showDevLogin ? (
          <div className="border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={devBusy}
              onClick={() => void tryDevLogin()}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              {devBusy ? "Вход…" : "Локальный dev-вход (ALLOW_DEV_LOGIN)"}
            </button>
            <p className="mt-2 text-center text-[10px] text-slate-400">
              На сервере нужен <code className="font-mono">ALLOW_DEV_LOGIN=true</code>.
            </p>
            {devErr ? (
              <p className="mt-2 text-center text-xs text-red-600" role="alert">
                {devErr}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
    </main>
  );
}
