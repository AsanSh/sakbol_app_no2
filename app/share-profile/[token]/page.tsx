"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SakbolMark } from "@/components/sakbol/sakbol-mark";
import { useTelegramSession } from "@/context/telegram-session-context";

type InviteInfo = {
  id: string;
  accepted: boolean;
  canWrite: boolean;
  inviteExpiresAt: string | null;
  profile: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    managedRole: string | null;
  };
};

export default function AcceptShareProfilePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token ?? "");
  const { isAuthenticated, authReady } = useTelegramSession();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptErr, setAcceptErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/profile/share/invite/${encodeURIComponent(token)}`)
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
  }, [token]);

  const handleAccept = async () => {
    if (!authReady) return;
    if (!isAuthenticated) {
      router.push(`/login?next=/share-profile/${token}`);
      return;
    }
    setAccepting(true);
    setAcceptErr(null);
    try {
      const res = await fetch(`/api/profile/share/invite/${encodeURIComponent(token)}`, {
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

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-white to-slate-100 px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-900/10 text-center">
        <SakbolMark size="lg" className="mx-auto" />
        <h1 className="mt-4 font-manrope text-xl font-extrabold text-[#004253]">
          Приглашение к совместному доступу
        </h1>

        {!info && !loadErr && (
          <p className="mt-6 text-sm text-slate-500 animate-pulse">Загрузка…</p>
        )}

        {loadErr && (
          <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">
            {loadErr === "Invite expired"
              ? "Приглашение истекло. Попросите владельца создать новое."
              : loadErr === "Invite not found or revoked"
                ? "Приглашение недействительно или отозвано."
                : loadErr}
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
              Профиль <strong>{info?.profile.displayName}</strong> появится в переключателе профилей.
              Переходим в приложение…
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
