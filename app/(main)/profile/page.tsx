"use client";

import { useCallback, useEffect, useState } from "react";
import { BiologicalSex } from "@prisma/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AddMemberModal } from "@/components/add-member-modal";
import { useLanguage } from "@/context/language-context";
import { useTelegramSession } from "@/context/telegram-session-context";
import type { FamilyWithProfiles } from "@/types/family";
import { t } from "@/lib/i18n";
import { updateProfileBiologicalSex } from "@/app/actions/profile";

function normalizeFamily(raw: unknown): FamilyWithProfiles {
  const f = raw as FamilyWithProfiles;
  return {
    ...f,
    profiles: f.profiles.map((p) => ({
      ...p,
      biologicalSex: p.biologicalSex ?? BiologicalSex.UNKNOWN,
      dateOfBirth:
        p.dateOfBirth == null
          ? null
          : typeof p.dateOfBirth === "string"
            ? p.dateOfBirth
            : new Date(p.dateOfBirth as unknown as Date).toISOString(),
    })),
  };
}

export default function ProfilePage() {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated, state } = useTelegramSession();
  const [family, setFamily] = useState<FamilyWithProfiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    void fetch("/api/family/default", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error("load failed");
        return r.json() as Promise<FamilyWithProfiles>;
      })
      .then((raw) => setFamily(normalizeFamily(raw)))
      .catch(() => setFamily(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated) {
      setFamily(null);
      setLoading(false);
      return;
    }
    load();
  }, [authReady, isAuthenticated, load]);

  const admin = family?.profiles.find((p) => p.familyRole === "ADMIN");
  const viewer = state.status === "authenticated" ? state.viewer : null;

  const canEditSex = (profileId: string) => {
    if (!viewer) return false;
    if (viewer.id === profileId) return true;
    return viewer.familyRole === "ADMIN";
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-6">
      <h1 className="text-2xl font-semibold text-emerald-950">{t(lang, "profile.title")}</h1>
      <p className="text-sm text-emerald-900/70">{t(lang, "profile.subtitle")}</p>

      {!authReady ? (
        <p className="text-sm text-emerald-900/70">{t(lang, "analyses.loading")}</p>
      ) : null}

      {authReady && !isAuthenticated ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-emerald-950">
          <p className="font-medium">{t(lang, "dashboard.authTitle")}</p>
          <p className="mt-1 text-emerald-900/80">{t(lang, "dashboard.authBody")}</p>
          {process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true" ? (
            <p className="mt-2 text-xs text-emerald-800/90">{t(lang, "dashboard.devHint")}</p>
          ) : null}
        </div>
      ) : null}

      {authReady && isAuthenticated && viewer ? (
        <section className="rounded-2xl border border-emerald-900/15 bg-white/90 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-emerald-950">{t(lang, "profile.viewer")}</h2>
          <p className="mt-2 text-base font-medium text-emerald-900">{viewer.displayName}</p>
          <p className="mt-1 text-xs text-emerald-800/80">
            {t(lang, "profile.role")}: {viewer.familyRole}
          </p>
        </section>
      ) : null}

      {authReady && isAuthenticated ? (
        <section className="rounded-2xl border border-emerald-900/15 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-emerald-950">{t(lang, "profile.family")}</h2>
            {admin ? (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="rounded-xl bg-emerald-900 px-3 py-1.5 text-xs font-medium text-mint"
              >
                {t(lang, "profile.addMember")}
              </button>
            ) : null}
          </div>
          {loading ? (
            <p className="mt-3 text-sm text-emerald-900/70">{t(lang, "analyses.loading")}</p>
          ) : family?.profiles?.length ? (
            <ul className="mt-3 space-y-2">
              {family.profiles.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-emerald-900/10 bg-emerald-900/5 px-3 py-2 text-sm text-emerald-950"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.displayName}</span>
                    <span className="text-xs text-emerald-800/75">{p.familyRole}</span>
                    {p.isManaged ? (
                      <span className="text-[10px] uppercase text-amber-700">managed</span>
                    ) : null}
                  </div>
                  {canEditSex(p.id) ? (
                    <label className="mt-2 flex flex-col gap-0.5 text-[11px] text-emerald-900/80">
                      <span>{t(lang, "profile.biologicalSex")}</span>
                      <select
                        className="rounded-lg border border-emerald-900/25 bg-white px-2 py-1.5 text-xs text-emerald-950"
                        value={p.biologicalSex}
                        onChange={(e) => {
                          const v = e.target.value as BiologicalSex;
                          void updateProfileBiologicalSex(p.id, v).then(() => load());
                        }}
                      >
                        <option value={BiologicalSex.UNKNOWN}>{t(lang, "profile.sexUnknown")}</option>
                        <option value={BiologicalSex.MALE}>{t(lang, "profile.sexMale")}</option>
                        <option value={BiologicalSex.FEMALE}>{t(lang, "profile.sexFemale")}</option>
                      </select>
                    </label>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-emerald-900/70">{t(lang, "profile.noProfiles")}</p>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-emerald-900/15 bg-white/90 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-emerald-950">{t(lang, "profile.language")}</h2>
        <p className="mt-1 text-xs text-emerald-900/70">{t(lang, "profile.languageHint")}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-emerald-900">RU / KG</span>
          <LanguageSwitcher />
        </div>
      </section>

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
    </div>
  );
}
