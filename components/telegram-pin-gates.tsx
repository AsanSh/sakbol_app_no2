"use client";

import { useState, useTransition, type FormEvent } from "react";
import { setOwnProfilePin } from "@/app/actions/profile-pin";
import { useTelegramSession, type TelegramViewer } from "@/context/telegram-session-context";

/** Полноэкранные шаги ПИН: новый пользователь Telegram или завершение профиля после миграции. */
export function TelegramPinGates() {
  const { state, submitNewUserPin, refresh } = useTelegramSession();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (state.status === "needs_new_user_pin") {
    const onSubmit = (e: FormEvent) => {
      e.preventDefault();
      setErr(null);
      startTransition(async () => {
        const r = await submitNewUserPin(pin);
        if (!r.ok) setErr(r.error);
        else setPin("");
      });
    };
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-new-user-title"
      >
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 shadow-xl">
          <h2 id="pin-new-user-title" className="text-lg font-semibold text-emerald-950">
            ПИН/ИНН для регистрации
          </h2>
          <p className="mt-2 text-sm text-emerald-800/80">
            Введите государственный идентификационный номер (10–20 цифр). Он не сохраняется в открытом
            виде — только защищённый идентификатор.
          </p>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <input
              inputMode="numeric"
              autoComplete="off"
              className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-base tracking-widest text-emerald-950 outline-none ring-emerald-600 focus-visible:ring-2"
              placeholder="Только цифры"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 20))}
              disabled={pending}
            />
            {err ? (
              <p className="text-sm text-coral" role="alert">
                {err}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending || pin.length < 10}
              className="w-full rounded-xl bg-sakbol-cta py-3 text-sm font-semibold text-white shadow-cta-coral transition-[filter] hover:brightness-[1.04] disabled:opacity-50"
            >
              {pending ? "Кирүү…" : "Улантуу"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (state.status === "authenticated" && state.viewer.needsPinCompletion) {
    return (
      <CompletePinForViewer
        viewer={state.viewer}
        onDone={() => {
          setPin("");
          refresh();
        }}
      />
    );
  }

  return null;
}

function CompletePinForViewer({
  viewer,
  onDone,
}: {
  viewer: TelegramViewer;
  onDone: () => void;
}) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      const r = await setOwnProfilePin(pin);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setPin("");
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-complete-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 shadow-xl">
        <h2 id="pin-complete-title" className="text-lg font-semibold text-emerald-950">
          Укажите ПИН/ИНН
        </h2>
        <p className="mt-2 text-sm text-emerald-800/80">
          Профиль <strong>{viewer.displayName}</strong> требует привязки ПИН/ИНН для дальнейшей работы.
        </p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            inputMode="numeric"
            autoComplete="off"
            className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-base tracking-widest text-emerald-950 outline-none ring-emerald-600 focus-visible:ring-2"
            placeholder="10–20 цифр"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 20))}
            disabled={pending}
          />
          {err ? (
            <p className="text-sm text-coral" role="alert">
              {err}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending || pin.length < 10}
            className="w-full rounded-xl bg-sakbol-cta py-3 text-sm font-semibold text-white shadow-cta-coral transition-[filter] hover:brightness-[1.04] disabled:opacity-50"
          >
            {pending ? "Сакталууда…" : "Сактоо"}
          </button>
        </form>
      </div>
    </div>
  );
}
