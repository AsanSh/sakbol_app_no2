"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { SakbolMark } from "@/components/sakbol/sakbol-mark";
import { useTelegramSession } from "@/context/telegram-session-context";

type InviteInfo = {
  id: string;
  accepted: boolean;
  canWrite: boolean;
  inviteExpiresAt: string | null;
  inviteCode9?: string;
  profile: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    managedRole: string | null;
  };
};

function normalizeCode(raw: string | null): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 9);
}

function JoinFamilyByCodePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = normalizeCode(searchParams.get("code"));
  const { isAuthenticated, authReady } = useTelegramSession();

  const [draftCode, setDraftCode] = useState("");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptErr, setAcceptErr] = useState<string | null>(null);

  useEffect(() => {
    if (code.length !== 9) {
      setInfo(null);
      setLoadErr(null);
      setAccepted(false);
      return;
    }
    setLoadErr(null);
    setInfo(null);
    setAccepted(false);
    fetch(`/api/profile/share/invite-by-code/${encodeURIComponent(code)}`)
      .then(async (r) => {
        const j = (await r.json()) as InviteInfo & { error?: string };
        if (!r.ok) {
          setLoadErr(j.error ?? "Ошибка загрузки");
          return;
        }
        setInfo(j);
        if (j.accepted) setAccepted(true);
      })
      .catch(() => setLoadErr("Ошибка сети"));
  }, [code]);

  const handleAccept = async () => {
    if (code.length !== 9) return;
    if (!authReady) return;
    if (!isAuthenticated) {
      const next = `/join-family?code=${code}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setAccepting(true);
    setAcceptErr(null);
    try {
      const res = await fetch(`/api/profile/share/invite-by-code/${encodeURIComponent(code)}`, {
        method: "POST",
        credentials: "include",
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setAcceptErr(j.error ?? "Не удалось принять приглашение");
        return;
      }
      setAccepted(true);
      setTimeout(() => router.replace("/"), 2000);
    } finally {
      setAccepting(false);
    }
  };

  function submitManual(e: FormEvent) {
    e.preventDefault();
    const v = normalizeCode(draftCode);
    if (v.length !== 9) return;
    router.replace(`/join-family?code=${v}`);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-white to-slate-100 px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-900/10 text-center">
        <SakbolMark size="lg" className="mx-auto" />
        <h1 className="mt-4 font-manrope text-xl font-extrabold text-[#004253]">
          Приглашение по коду
        </h1>

        {code.length !== 9 ? (
          <form className="mt-6 space-y-3 text-left" onSubmit={submitManual}>
            <p className="text-sm text-slate-600">
              Введите 9 цифр, которые вам отправили, или откройте ссылку из приглашения.
            </p>
            <label className="block text-xs font-medium text-slate-600" htmlFor="join-code">
              Код (9 цифр)
            </label>
            <input
              id="join-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.35em] text-slate-900 outline-none ring-[#004253] focus-visible:ring-2"
              value={draftCode}
              onChange={(e) => setDraftCode(e.target.value.replace(/\D/g, "").slice(0, 9))}
              placeholder="000000000"
              maxLength={9}
            />
            <button
              type="submit"
              disabled={normalizeCode(draftCode).length !== 9}
              className="w-full rounded-2xl bg-[#004253] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#003845] disabled:opacity-50"
            >
              Продолжить
            </button>
          </form>
        ) : (
          <>
            <p className="mt-2 font-mono text-lg font-bold tracking-widest text-slate-800">{code}</p>

            {!info && !loadErr && (
              <p className="mt-6 text-sm text-slate-500 animate-pulse">Загрузка…</p>
            )}

            {loadErr && (
              <div className="mt-6 space-y-3">
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">
                  {loadErr === "Invite expired"
                    ? "Приглашение истекло. Попросите владельца создать новое."
                    : loadErr === "Invite not found or revoked"
                      ? "Код недействителен или доступ отозван."
                      : loadErr}
                </div>
                <button
                  type="button"
                  onClick={() => router.replace("/join-family")}
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700"
                >
                  Ввести другой код
                </button>
              </div>
            )}

            {info && !accepted && (
              <>
                <div className="mt-6 flex flex-col items-center gap-2">
                  {info.profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={info.profile.avatarUrl}
                      alt=""
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-teal-200"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-2xl font-bold text-teal-700 ring-2 ring-teal-200">
                      {info.profile.displayName[0]?.toUpperCase()}
                    </div>
                  )}
                  <p className="text-lg font-semibold text-slate-900">{info.profile.displayName}</p>
                  <p className="text-xs text-slate-500">
                    {info.canWrite
                      ? "Вы сможете просматривать и добавлять документы"
                      : "Только просмотр документов"}
                  </p>
                </div>

                {acceptErr && (
                  <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-900 ring-1 ring-red-200">
                    {acceptErr === "Cannot accept your own family's invite"
                      ? "Нельзя принять приглашение на профиль своей же семьи."
                      : acceptErr}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={accepting}
                  className="mt-6 w-full rounded-2xl bg-[#004253] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#003845] disabled:opacity-50"
                >
                  {accepting
                    ? "Принятие…"
                    : isAuthenticated
                      ? "Принять и открыть профиль"
                      : "Войти и принять приглашение"}
                </button>
              </>
            )}

            {accepted && (
              <div className="mt-6 rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
                <p className="font-semibold">Доступ принят!</p>
                <p className="mt-1 text-xs">
                  Профиль <strong>{info?.profile.displayName}</strong> появится в переключателе
                  профилей. Переходим в приложение…
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function JoinFamilyByCodePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-100 to-white px-6">
          <p className="text-sm text-slate-500">Загрузка…</p>
        </main>
      }
    >
      <JoinFamilyByCodePageInner />
    </Suspense>
  );
}
