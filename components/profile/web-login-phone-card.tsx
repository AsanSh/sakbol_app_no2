"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  onSaved?: () => void;
};

/**
 * Сохранение номера для входа на сайт по коду (если @username / id боту не срабатывают).
 */
export function WebLoginPhoneCard({ onSaved }: Props) {
  const [phone, setPhone] = useState("");
  const [masked, setMasked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch("/api/profile/web-login-phone", { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        has?: boolean;
        masked?: string | null;
      };
      if (!r.ok) {
        setErr(j.error ?? `Ошибка ${r.status}`);
        return;
      }
      if (j.has && j.masked) {
        setMasked(j.masked);
        setPhone("");
      } else {
        setMasked(null);
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/profile/web-login-phone", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; masked?: string };
      if (!r.ok) {
        setErr(j.error ?? `Ошибка ${r.status}`);
        return;
      }
      if (j.masked) {
        setMasked(j.masked);
        setPhone("");
        onSaved?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/profile/web-login-phone", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setErr(j.error ?? `Ошибка ${r.status}`);
        return;
      }
      setMasked(null);
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-center text-xs text-slate-500">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="font-manrope text-sm font-bold text-[#004253]">Вход на сайт по коду (телефон)</p>
      <p className="mt-1 text-xs text-slate-600">
        Если с сайта не принимает @username, id или t.me, сохраните сюда тот же номер, что в Telegram.
        Потом на странице входа укажите этот номер в поле «телефон» — бот пришлёт код.
      </p>
      {masked ? (
        <p className="mt-2 text-center font-mono text-sm font-semibold text-[#004253]">{masked}</p>
      ) : null}
      <label className="mt-2 block text-left text-xs font-medium text-slate-600">
        Номер
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={busy}
          placeholder={masked ? "Новый номер" : "+996 555 12 34 56"}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy || !phone.trim()}
          onClick={() => void save()}
          className="flex-1 rounded-xl bg-[#004253] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "…" : masked ? "Обновить номер" : "Сохранить"}
        </button>
        {masked ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void clear()}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 disabled:opacity-50"
          >
            Убрать
          </button>
        ) : null}
      </div>
      {err ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
