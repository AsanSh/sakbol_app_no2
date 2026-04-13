"use client";

import { ManagedRelationRole } from "@prisma/client";
import { useState, useTransition, type FormEvent } from "react";
import { createManagedProfile } from "@/app/actions/family";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const ROLES: { value: ManagedRelationRole; label: string }[] = [
  { value: ManagedRelationRole.CHILD, label: "Бала" },
  { value: ManagedRelationRole.ELDER, label: "Улуктар" },
  { value: ManagedRelationRole.OTHER, label: "Башка" },
];

export function AddMemberModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [managedRole, setManagedRole] = useState<ManagedRelationRole>(
    ManagedRelationRole.CHILD,
  );
  const [dob, setDob] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createManagedProfile({
        displayName: name,
        managedRole,
        dateOfBirth: dob.trim() || null,
      });
      if (res.ok) {
        setName("");
        setDob("");
        setManagedRole(ManagedRelationRole.CHILD);
        onCreated();
        onClose();
      } else {
        setMessage(res.error);
      }
    });
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
        onClick={() => !pending && onClose()}
      />
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-emerald-900/15 bg-white p-5 shadow-xl",
        )}
      >
        <h2 id="add-member-title" className="text-lg font-semibold text-emerald-950">
          {"\u04af\u0439-\u0431\u04af\u043b\u04e9 \u043c\u04af\u0447\u04e9\u0441\u04af\u043d \u043a\u043e\u0448\u0443\u0443"}
        </h2>
        <p className="mt-1 text-sm text-emerald-900/70">
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
              Туулган күнү (милдеттүү эмес)
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-emerald-900/20 px-3 py-2 text-sm text-emerald-950 outline-none ring-emerald-600 focus-visible:ring-2"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              disabled={pending}
            />
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
              disabled={pending || !name.trim()}
              className="rounded-xl bg-emerald-900 px-4 py-2 text-sm font-medium text-mint disabled:opacity-50"
            >
              {pending ? "Сакталууда…" : "Кошуу"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
