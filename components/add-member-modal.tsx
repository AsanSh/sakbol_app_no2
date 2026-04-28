"use client";

import { BiologicalSex, ManagedRelationRole } from "@prisma/client";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createManagedProfile } from "@/app/actions/family";
import { cn } from "@/lib/utils";
import type { ProfileSummary } from "@/types/family";
import { telegramBotUsernameFromEnv } from "@/lib/telegram-public-urls";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Профили своей семьи (без гостевых) — если непусто, показывается вкладка приглашения по коду/QR. */
  familyProfilesForInvite?: ProfileSummary[];
};

type InvitePayload = {
  id: string;
  inviteToken: string;
  inviteCode9: string;
  inviteExpiresAt: string | null;
  profileName: string;
};

const ROLES: { value: ManagedRelationRole; label: string }[] = [
  { value: ManagedRelationRole.CHILD, label: "Ребёнок (пол: сын / дочь)" },
  { value: ManagedRelationRole.SPOUSE, label: "Супруг(а)" },
  { value: ManagedRelationRole.ELDER, label: "Родитель / старшее поколение" },
  { value: ManagedRelationRole.OTHER, label: "Другой родственник" },
];

export function AddMemberModal({
  open,
  onClose,
  onCreated,
  familyProfilesForInvite,
}: Props) {
  const inviteCandidates =
    familyProfilesForInvite?.filter((p) => !p.isSharedGuest) ?? [];
  const showInviteTab = inviteCandidates.length > 0;

  const [tab, setTab] = useState<"managed" | "invite">("managed");

  const [name, setName] = useState("");
  const [managedRole, setManagedRole] = useState<ManagedRelationRole>(
    ManagedRelationRole.CHILD,
  );
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex>(BiologicalSex.UNKNOWN);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [inviteCreating, setInviteCreating] = useState(false);
  const [resolvedBotUsername, setResolvedBotUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | "tg" | null>(null);

  useEffect(() => {
    if (!open) {
      setTab("managed");
      setInvite(null);
      setInviteErr(null);
      setCopied(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "invite") return;
    if (telegramBotUsernameFromEnv()) return;
    let cancelled = false;
    void fetch("/api/public/telegram-bot-username")
      .then((r) => r.json() as Promise<{ username?: string | null }>)
      .then((j) => {
        if (!cancelled && j.username) setResolvedBotUsername(j.username);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, tab]);

  useEffect(() => {
    if (tab === "managed") setInvite(null);
  }, [tab]);

  if (!open) return null;

  const botU = telegramBotUsernameFromEnv() || resolvedBotUsername || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createManagedProfile({
        displayName: name,
        managedRole,
        biologicalSex,
        pin,
      });
      if (res.ok) {
        setName("");
        setPin("");
        setManagedRole(ManagedRelationRole.CHILD);
        setBiologicalSex(BiologicalSex.UNKNOWN);
        onCreated();
        onClose();
      } else {
        setMessage(res.error);
      }
    });
  }

  async function createShareInvite() {
    if (!selectedProfileId) return;
    setInviteCreating(true);
    setInviteErr(null);
    try {
      const res = await fetch("/api/profile/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ profileId: selectedProfileId, expiresInDays: 30 }),
      });
      const j = (await res.json()) as InvitePayload & { error?: string };
      if (!res.ok) {
        setInviteErr(j.error ?? "Ката кетти");
        return;
      }
      if (!j.inviteCode9) {
        setInviteErr("Сервер кодду кайтарган жок. Кайра аракет кылыңыз.");
        return;
      }
      setInvite(j);
      onCreated();
    } finally {
      setInviteCreating(false);
    }
  }

  async function revokeInvite() {
    if (!invite) return;
    await fetch(`/api/profile/share?id=${invite.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setInvite(null);
    setCopied(null);
    onCreated();
  }

  const joinCode = invite?.inviteCode9 ?? "";
  const webJoinUrl =
    joinCode && origin ? `${origin}/join-family?code=${joinCode}` : null;
  const telegramJoinStartUrl =
    joinCode && botU ? `https://t.me/${botU}?start=join_${joinCode}` : null;
  const telegramJoinMiniUrl =
    joinCode && botU ? `https://t.me/${botU}?startapp=join_${joinCode}` : null;
  const qrValue = telegramJoinStartUrl ?? webJoinUrl;

  function flashCopied(kind: "code" | "link" | "tg") {
    setCopied(kind);
    setTimeout(() => setCopied(null), 2200);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-emerald-950/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Жабуу"
        onClick={() => !pending && !inviteCreating && onClose()}
      />
      <div
        className={cn(
          "relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-emerald-900/15 bg-white p-5 shadow-xl",
        )}
      >
        <h2 id="add-member-title" className="text-lg font-semibold text-emerald-950">
          Үй-бүлө мүчөсүн кошуу
        </h2>
        <p className="mt-1 text-sm text-emerald-900/70">
          Башкарылуучу кароо (Telegram жок) же чакыруу коду / QR аркылуу бөлүшүү.
        </p>

        {showInviteTab ? (
          <div className="mt-4 flex gap-1 rounded-xl bg-emerald-900/5 p-1">
            <button
              type="button"
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors",
                tab === "managed"
                  ? "bg-white text-emerald-950 shadow-sm"
                  : "text-emerald-900/70",
              )}
              onClick={() => setTab("managed")}
            >
              Кароо астында
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors",
                tab === "invite"
                  ? "bg-white text-emerald-950 shadow-sm"
                  : "text-emerald-900/70",
              )}
              onClick={() => {
                setTab("invite");
                const first = inviteCandidates[0]?.id ?? "";
                if (first) setSelectedProfileId(first);
              }}
            >
              Код / QR чакыруу
            </button>
          </div>
        ) : null}

        {tab === "managed" ? (
          <>
            <p className="mt-3 text-xs text-emerald-900/65">
              Telegram аккаунту жок кароо астындагы адам (бала, чоң ата/эне).
            </p>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-emerald-900/80">
                  Аты-жөнү
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-emerald-900/20 px-3 py-2 text-sm text-emerald-950 outline-none ring-emerald-600 focus-visible:ring-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={pending}
                  placeholder="Мисалы: Сын, 5 жаш"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-emerald-900/80">
                  Роль
                </label>
                <select
                  className="mt-1 w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2 text-sm text-emerald-950 outline-none ring-emerald-600 focus-visible:ring-2"
                  value={managedRole}
                  onChange={(e) =>
                    setManagedRole(e.target.value as ManagedRelationRole)
                  }
                  disabled={pending}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-emerald-900/80">
                  Биологиялык жыныс
                </label>
                <select
                  className="mt-1 w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2 text-sm text-emerald-950 outline-none ring-emerald-600 focus-visible:ring-2"
                  value={biologicalSex}
                  onChange={(e) => setBiologicalSex(e.target.value as BiologicalSex)}
                  disabled={pending}
                >
                  <option value={BiologicalSex.UNKNOWN}>Көрсөтүлгөн эмес</option>
                  <option value={BiologicalSex.MALE}>Эркек</option>
                  <option value={BiologicalSex.FEMALE}>Аял</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-emerald-900/80">
                  ПИН / ИНН (КР) — милдеттүү, 10–20 сан
                </label>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  className="mt-1 w-full rounded-xl border border-emerald-900/20 px-3 py-2 text-sm tracking-wider text-emerald-950 outline-none ring-emerald-600 focus-visible:ring-2"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 20))}
                  required
                  disabled={pending}
                  placeholder="Сан гана, пробелсиз"
                />
                <p className="mt-1 text-[10px] text-emerald-800/65">
                  Ачык ПИН сакталбайт — серверде гана корголгон идентификатор.
                </p>
              </div>

              {message ? (
                <p className="text-sm text-coral" role="alert">
                  {message}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-emerald-900/80 hover:bg-emerald-900/5"
                  onClick={() => !pending && onClose()}
                  disabled={pending}
                >
                  Жабуу
                </button>
                <button
                  type="submit"
                  disabled={pending || !name.trim() || pin.length < 10}
                  className="rounded-xl bg-sakbol-cta px-4 py-2 text-sm font-medium text-white shadow-sm shadow-coral/25 transition-[filter] hover:brightness-[1.05] disabled:opacity-50"
                >
                  {pending ? "Сакталууда…" : "Кошуу"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="mt-4 space-y-3">
            {!invite ? (
              <>
                <p className="text-xs text-emerald-900/75">
                  Тандаңыз: кайсы профиль бөлүшүлөт. 9 орундуу код менен QR чыгат. Кабыл алуучу эки жол менен
                  кошулушу мүмкүн: <strong>кодду</strong> киргизүү же <strong>QR</strong> сканерлөө
                  (/join-family: камера, сүрөт же код).
                </p>
                {inviteCandidates.length > 1 ? (
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2 text-sm"
                  >
                    {inviteCandidates.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                ) : null}
                {inviteErr ? (
                  <p className="text-xs text-red-700" role="alert">
                    {inviteErr}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={inviteCreating || !selectedProfileId}
                  onClick={() => void createShareInvite()}
                  className="w-full rounded-xl bg-sakbol-cta py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {inviteCreating ? "Түзүлүүдө…" : "Чакырууну түзүү"}
                </button>
              </>
            ) : (
              <>
                <p className="text-center text-xs text-emerald-900/70">
                  Профиль: <strong>{invite.profileName}</strong>
                </p>
                <p className="text-center font-mono text-2xl font-bold tracking-[0.25em] text-emerald-950">
                  {invite.inviteCode9}
                </p>
                <div className="flex justify-center rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  {qrValue ? (
                    <QRCodeSVG value={qrValue} size={168} level="M" includeMargin />
                  ) : null}
                </div>
                <p className="text-[11px] text-emerald-900/65">
                  QR камера Telegram&apos;ды ачат → бот кодду сактайт → Mini App&apos;ка киргенде
                  профиль кошулат. Сайт үчүн шилтемени көчүрүңүз.
                </p>
                {telegramJoinStartUrl ? (
                  <a
                    href={telegramJoinStartUrl}
                    className="flex w-full items-center justify-center rounded-xl bg-sky-50 py-2.5 text-sm font-semibold text-sky-900 ring-1 ring-sky-200"
                  >
                    Telegram&apos;да ачуу
                  </a>
                ) : null}
                {telegramJoinMiniUrl ? (
                  <a
                    href={telegramJoinMiniUrl}
                    className="flex w-full items-center justify-center rounded-xl bg-slate-50 py-2 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200"
                  >
                    Mini App түз ачуу
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(invite.inviteCode9).catch(() => {});
                      flashCopied("code");
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-teal-50 py-2 text-xs font-semibold text-teal-900 ring-1 ring-teal-100"
                  >
                    {copied === "code" ? "Көчүрүлдү" : "Кодду көчүрүү"}
                  </button>
                  {webJoinUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(webJoinUrl).catch(() => {});
                        flashCopied("link");
                      }}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white py-2 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200"
                    >
                      {copied === "link" ? "Көчүрүлдү" : "Сайт шилтемеси"}
                    </button>
                  ) : null}
                  {telegramJoinStartUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(telegramJoinStartUrl).catch(() => {});
                        flashCopied("tg");
                      }}
                      className="flex flex-1 basis-full items-center justify-center gap-1 rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-800 ring-1 ring-slate-200 sm:basis-auto"
                    >
                      {copied === "tg" ? "Көчүрүлдү" : "t.me шилтемеси"}
                    </button>
                  ) : null}
                </div>
                {invite.inviteExpiresAt ? (
                  <p className="text-[11px] text-emerald-800/60">
                    Аяктоо:{" "}
                    {new Date(invite.inviteExpiresAt).toLocaleDateString("ky-KG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void revokeInvite()}
                    className="flex-1 rounded-xl bg-red-50 py-2 text-xs font-semibold text-red-900 ring-1 ring-red-100"
                  >
                    Токтотуу
                  </button>
                  <button
                    type="button"
                    onClick={() => !inviteCreating && onClose()}
                    className="flex-1 rounded-xl py-2 text-xs font-semibold text-emerald-900/80 ring-1 ring-emerald-900/15"
                  >
                    Даяр
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
