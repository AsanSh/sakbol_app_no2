"use client";

import { useCallback, useState } from "react";

export function EmailAuthPanel() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submitLogin = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? `Ошибка ${res.status}`);
        return;
      }
      window.location.assign("/");
    } finally {
      setBusy(false);
    }
  }, [email, password]);

  const submitRegister = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          pin: pin.trim(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? `Ошибка ${res.status}`);
        return;
      }
      window.location.assign("/");
    } finally {
      setBusy(false);
    }
  }, [displayName, email, password, pin]);

  return (
    <div className="space-y-4">
      <div className="flex rounded-xl bg-slate-100 p-1 text-[11px] font-semibold">
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 ${mode === "login" ? "bg-white shadow-sm text-[#004253]" : "text-slate-600"}`}
          onClick={() => {
            setMode("login");
            setErr(null);
          }}
        >
          Вход по email
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 ${mode === "register" ? "bg-white shadow-sm text-[#004253]" : "text-slate-600"}`}
          onClick={() => {
            setMode("register");
            setErr(null);
          }}
        >
          Регистрация
        </button>
      </div>

      {err ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-900" role="alert">
          {err}
        </p>
      ) : null}

      <label className="block text-left text-xs font-medium text-slate-600">
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#229ED9]"
        />
      </label>
      <label className="block text-left text-xs font-medium text-slate-600">
        Пароль
        <input
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#229ED9]"
        />
      </label>

      {mode === "register" ? (
        <>
          <label className="block text-left text-xs font-medium text-slate-600">
            Как к вам обращаться
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#229ED9]"
            />
          </label>
          <label className="block text-left text-xs font-medium text-slate-600">
            ПИН / ИНН (10–20 цифр)
            <input
              type="password"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\s/g, ""))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#229ED9]"
            />
          </label>
        </>
      ) : null}

      <button
        type="button"
        disabled={busy || !email.trim() || !password}
        onClick={() => void (mode === "login" ? submitLogin() : submitRegister())}
        className="w-full rounded-2xl bg-[#004253] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#003845] disabled:opacity-50"
      >
        {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
      </button>
      <p className="text-center text-[10px] leading-relaxed text-slate-500">
        После регистрации можно привязать Telegram в профиле: код и команда /start у бота.
      </p>
    </div>
  );
}
