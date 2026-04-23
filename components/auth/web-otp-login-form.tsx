"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Lock, Mail, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { EmailAuthPanel } from "@/components/auth/email-auth-panel";
import { SakbolMark } from "@/components/sakbol/sakbol-mark";
import { APP_NAME } from "@/constants";
import { useTelegramSession } from "@/context/telegram-session-context";

type Props = {
  urlBannerError?: string | null;
};

// ── Экран выбора метода входа ──────────────────────────────────────────────

function ChoiceScreen({
  onChoose,
  banner,
}: {
  onChoose: (m: "telegram" | "email") => void;
  banner?: string | null;
}) {
  return (
    <motion.div
      key="choice"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28 }}
      className="space-y-4"
    >
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Выберите способ</p>
      </div>

      {banner ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-950" role="status">
          {banner}
        </p>
      ) : null}

      {/* Telegram OTP */}
      <button
        type="button"
        onClick={() => onChoose("telegram")}
        className="group flex w-full items-center gap-4 rounded-2xl border-2 border-[#229ED9]/30 bg-[#229ED9]/5 px-4 py-4 text-left transition-all hover:border-[#229ED9]/60 hover:bg-[#229ED9]/10 active:scale-[0.98]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#229ED9] shadow-md shadow-[#229ED9]/30">
          <Send className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-800">Войти через Telegram</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
            Одноразовый код — бот отправит в чат
          </span>
        </span>
        <ArrowLeft className="h-4 w-4 rotate-180 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>

      {/* Email / пароль */}
      <button
        type="button"
        onClick={() => onChoose("email")}
        className="group flex w-full items-center gap-4 rounded-2xl border-2 border-[#004253]/20 bg-[#004253]/5 px-4 py-4 text-left transition-all hover:border-[#004253]/40 hover:bg-[#004253]/8 active:scale-[0.98]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#004253] shadow-md shadow-[#004253]/30">
          <Mail className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-800">Войти по Email</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
            Логин и пароль · или создать аккаунт
          </span>
        </span>
        <ArrowLeft className="h-4 w-4 rotate-180 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </motion.div>
  );
}

// ── Форма входа через Telegram OTP ────────────────────────────────────────

function TelegramOtpForm({
  onBack,
}: {
  onBack: () => void;
}) {
  const router = useRouter();
  const { refresh } = useTelegramSession();
  const [telegram, setTelegram] = useState("");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"request" | "verify" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canRequest = Boolean(telegram.trim()) || Boolean(phone.trim());
  const requestCode = useCallback(async () => {
    setErr(null);
    setBusy("request");
    try {
      const res = await fetch("/api/auth/web-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram: telegram.trim(), phone: phone.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; challengeId?: string };
      if (!res.ok) { setErr(j.error ?? `Ошибка ${res.status}`); return; }
      if (!j.challengeId) { setErr("Пустой ответ сервера."); return; }
      setChallengeId(j.challengeId);
      setCode("");
    } finally {
      setBusy(null);
    }
  }, [telegram, phone]);

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
      if (!res.ok) { setErr(j.error ?? `Ошибка ${res.status}`); return; }
      refresh();
      router.replace("/");
    } finally {
      setBusy(null);
    }
  }, [challengeId, code, refresh, router]);

  return (
    <motion.div
      key="telegram-otp"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Шапка с кнопкой назад */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          aria-label="Назад"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#229ED9]">
            <Send className="h-3.5 w-3.5 text-white" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-sm font-bold text-slate-800">Вход через Telegram</span>
        </div>
      </div>

      {err ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-900" role="alert">{err}</p>
      ) : null}

      <p className="text-[11px] leading-relaxed text-slate-500">
        Укажите <strong className="font-semibold text-slate-600">@username, ссылку t.me, id</strong> (после /start
        у бота) и/или <strong className="font-semibold text-slate-600">телефон</strong>, тот же, что в разделе
        «Вход на сайт по коду» в Профиле приложения, если @username боту не срабатывал.
      </p>

      <label className="block text-left text-xs font-medium text-slate-600">
        Telegram
        <input
          type="text"
          name="telegram"
          autoComplete="username"
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
          disabled={Boolean(challengeId)}
          placeholder="@username, t.me/…, id (можно пусто, если есть телефон)"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#229ED9] disabled:bg-slate-50"
        />
      </label>

      <label className="block text-left text-xs font-medium text-slate-600">
        Телефон (сохранённый в Профиле)
        <input
          type="tel"
          name="webLoginPhone"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={Boolean(challengeId)}
          placeholder="Например +996 555 12 34 56 (необязательно)"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#229ED9] disabled:bg-slate-50"
        />
      </label>

      {!challengeId ? (
        <button
          type="button"
          disabled={busy !== null || !canRequest}
          onClick={() => void requestCode()}
          className="w-full rounded-2xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1e8bc7] disabled:opacity-50"
        >
          {busy === "request" ? "Отправка…" : "Получить код"}
        </button>
      ) : (
        <>
          <p className="rounded-xl bg-teal-50 px-3 py-2 text-center text-[11px] text-teal-800">
            Код отправлен ботом. Проверьте чат (действует 10 мин).
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
            onClick={() => { setChallengeId(null); setCode(""); setErr(null); }}
            className="w-full text-center text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
          >
            Другой аккаунт / новый код
          </button>
        </>
      )}
    </motion.div>
  );
}

// ── Форма входа по Email ───────────────────────────────────────────────────

function EmailLoginForm({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      key="email"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Шапка с кнопкой назад */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          aria-label="Назад"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#004253]">
            <Mail className="h-3.5 w-3.5 text-white" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-sm font-bold text-slate-800">Вход по Email</span>
        </div>
      </div>

      <EmailAuthPanel />
    </motion.div>
  );
}

// ── Dev-login ─────────────────────────────────────────────────────────────

function DevLoginButton() {
  const router = useRouter();
  const { refresh } = useTelegramSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tryDev = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/dev", { method: "POST", credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErr(j.error ?? `Ошибка ${res.status}`); return; }
      refresh();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }, [refresh, router]);

  return (
    <div className="border-t border-slate-100 pt-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => void tryDev()}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
      >
        {busy ? "Вход…" : "Локальный dev-вход"}
      </button>
      {err ? <p className="mt-2 text-center text-xs text-red-600">{err}</p> : null}
    </div>
  );
}

// ── Главный компонент ──────────────────────────────────────────────────────

type Method = "choice" | "telegram" | "email";

export function WebOtpLoginForm({ urlBannerError }: Props) {
  const showDevLogin = process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true";
  const [method, setMethod] = useState<Method>("choice");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-white to-slate-100 px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-7 shadow-2xl shadow-slate-900/10"
      >
        {/* Логотип — всегда виден */}
        <div className="mb-6 flex flex-col items-center text-center">
          <SakbolMark size="lg" className="ring-[#004253]/20 shadow-md" />
          <h1 className="mt-3 font-manrope text-2xl font-extrabold text-[#004253]">{APP_NAME}</h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-teal-700">
            Медицинские данные семьи
          </p>
        </div>

        {/* Контент меняется в зависимости от выбора */}
        <AnimatePresence mode="wait" initial={false}>
          {method === "choice" && (
            <ChoiceScreen
              key="choice"
              onChoose={setMethod}
              banner={urlBannerError}
            />
          )}
          {method === "telegram" && (
            <TelegramOtpForm
              key="telegram"
              onBack={() => setMethod("choice")}
            />
          )}
          {method === "email" && (
            <EmailLoginForm
              key="email"
              onBack={() => setMethod("choice")}
            />
          )}
        </AnimatePresence>

        {/* Dev-логин — только в режиме разработки */}
        {showDevLogin && method === "choice" ? <DevLoginButton /> : null}

        {/* Иконка замка + подпись */}
        {method === "choice" && (
          <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
            Данные защищены · ПИН/ИНН не хранится в открытом виде
          </p>
        )}
      </motion.div>
    </main>
  );
}
