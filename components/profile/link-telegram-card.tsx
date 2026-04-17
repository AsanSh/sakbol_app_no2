"use client";

import { useState } from "react";

type Props = {
  onReload: () => void;
};

export function LinkTelegramCard({ onReload }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [payload, setPayload] = useState<{ code: string; hint: string } | null>(null);

  const gen = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/profile/telegram-link", { method: "POST", credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string; hint?: string };
      if (!r.ok) {
        setMsg(j.error ?? `Ошибка ${r.status}`);
        return;
      }
      if (!j.code || !j.hint) {
        setMsg("Пустой ответ сервера.");
        return;
      }
      setPayload({ code: j.code, hint: j.hint });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#229ED9]/40 bg-[#e8f4fc] p-4 shadow-sm">
      <p className="font-manrope text-sm font-bold text-[#004253]">Привязать Telegram</p>
      <p className="mt-1 text-xs text-slate-700">
        Один аккаунт в базе: после привязки мини-приложение и сайт используют одни и те же данные.
      </p>
      {!payload ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void gen()}
          className="mt-3 w-full rounded-xl bg-[#229ED9] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Генерация…" : "Получить код для бота"}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-center font-mono text-2xl font-bold tracking-wider text-[#004253]">
            {payload.code}
          </p>
          <p className="text-[11px] leading-relaxed text-slate-700">{payload.hint}</p>
          <button
            type="button"
            className="w-full text-xs font-medium text-[#004253] underline decoration-[#004253]/40 underline-offset-2"
            onClick={() => {
              setPayload(null);
              onReload();
            }}
          >
            Обновить статус после команды в боте
          </button>
        </div>
      )}
      {msg ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
