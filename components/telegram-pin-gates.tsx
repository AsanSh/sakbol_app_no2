"use client";

import { SubjectIdCountry } from "@prisma/client";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { SubjectIdCountrySelect, SubjectIdNumberInput } from "@/components/subject-id-inputs";
import { setOwnProfilePin } from "@/app/actions/profile-pin";
import {
  inferSubjectIdCountryFromTelegramLang,
  isSubjectIdLengthSatisfied,
} from "@/lib/subject-id-country";
import { useTelegramSession, type TelegramViewer } from "@/context/telegram-session-context";

/** Полноэкранные шаги ПИН: новый пользователь Telegram или завершение профиля после миграции. */
export function TelegramPinGates() {
  const { state, submitNewUserPin, refresh } = useTelegramSession();
  const [country, setCountry] = useState<SubjectIdCountry>(SubjectIdCountry.KG);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void import("@twa-dev/sdk").then(({ default: WebApp }) => {
      if (cancelled) return;
      const lang = WebApp.initDataUnsafe?.user?.language_code;
      const inferred = inferSubjectIdCountryFromTelegramLang(lang);
      if (inferred) setCountry(inferred);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "needs_new_user_pin") {
    const onSubmit = (e: FormEvent) => {
      e.preventDefault();
      setErr(null);
      startTransition(async () => {
        const r = await submitNewUserPin(pin, country);
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
            Идентификатор для регистрации
          </h2>
          <p className="mt-2 text-sm text-emerald-800/80">
            Выберите страну документа и введите номер (ИИН, ПИН, ПИНФЛ, СНИЛС и т.д.). Номер не
            хранится в открытом виде — только защищённый идентификатор.
          </p>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-emerald-900/75">
                Страна выдачи документа
              </label>
              <SubjectIdCountrySelect value={country} onChange={setCountry} disabled={pending} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-emerald-900/75">
                Номер
              </label>
              <SubjectIdNumberInput country={country} value={pin} onChange={setPin} disabled={pending} />
            </div>
            {err ? (
              <p className="text-sm text-coral" role="alert">
                {err}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending || !isSubjectIdLengthSatisfied(country, pin)}
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
  const [country, setCountry] = useState<SubjectIdCountry>(
    (viewer.subjectIdCountry as SubjectIdCountry | undefined) ?? SubjectIdCountry.KG,
  );
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void import("@twa-dev/sdk").then(({ default: WebApp }) => {
      if (cancelled) return;
      const lang = WebApp.initDataUnsafe?.user?.language_code;
      const inferred = inferSubjectIdCountryFromTelegramLang(lang);
      if (inferred && !viewer.subjectIdCountry) setCountry(inferred);
    });
    return () => {
      cancelled = true;
    };
  }, [viewer.subjectIdCountry]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      const r = await setOwnProfilePin(pin, country);
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
          Укажите идентификатор
        </h2>
        <p className="mt-2 text-sm text-emerald-800/80">
          Профиль <strong>{viewer.displayName}</strong> требует привязки гос. номера для дальнейшей
          работы.
        </p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-emerald-900/75">
              Страна документа
            </label>
            <SubjectIdCountrySelect value={country} onChange={setCountry} disabled={pending} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-emerald-900/75">Номер</label>
            <SubjectIdNumberInput country={country} value={pin} onChange={setPin} disabled={pending} />
          </div>
          {err ? (
            <p className="text-sm text-coral" role="alert">
              {err}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending || !isSubjectIdLengthSatisfied(country, pin)}
            className="w-full rounded-xl bg-sakbol-cta py-3 text-sm font-semibold text-white shadow-cta-coral transition-[filter] hover:brightness-[1.04] disabled:opacity-50"
          >
            {pending ? "Сакталууда…" : "Сактоо"}
          </button>
        </form>
      </div>
    </div>
  );
}
