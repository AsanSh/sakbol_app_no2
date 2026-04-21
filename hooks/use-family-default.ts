"use client";

import { useCallback, useEffect, useState } from "react";
import { BiologicalSex } from "@prisma/client";
import type { FamilyWithProfiles } from "@/types/family";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

function normalizeProfile(p: FamilyWithProfiles["profiles"][number]) {
  return {
    ...p,
    email: p.email ?? null,
    biologicalSex: p.biologicalSex ?? BiologicalSex.UNKNOWN,
    dateOfBirth:
      p.dateOfBirth == null
        ? null
        : typeof p.dateOfBirth === "string"
          ? p.dateOfBirth
          : new Date(p.dateOfBirth as unknown as Date).toISOString(),
    heightCm: p.heightCm ?? null,
    weightKg: p.weightKg ?? null,
    bloodType: p.bloodType ?? null,
  };
}

function normalizeFamily(raw: unknown): FamilyWithProfiles {
  const f = raw as FamilyWithProfiles & { sharedProfiles?: FamilyWithProfiles["profiles"] };
  const ownProfiles = f.profiles.map(normalizeProfile);
  // Расшаренные профили добавляем в конец общего списка
  const sharedProfiles = (f.sharedProfiles ?? []).map((p) => ({
    ...normalizeProfile(p),
    isSharedGuest: true,
    sharedAccessId: (p as { sharedAccessId?: string }).sharedAccessId,
    sharedCanWrite: (p as { sharedCanWrite?: boolean }).sharedCanWrite ?? true,
  }));
  return {
    ...f,
    profiles: [...ownProfiles, ...sharedProfiles],
    sharedProfiles,
  };
}

export function useFamilyDefault() {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated } = useTelegramSession();
  const [family, setFamily] = useState<FamilyWithProfiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetch("/api/family/default", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) throw new Error(t(lang, "dashboard.authRequired"));
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? r.statusText);
        }
        return r.json() as Promise<FamilyWithProfiles>;
      })
      .then((raw) => setFamily(normalizeFamily(raw)))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "…");
        setFamily(null);
      })
      .finally(() => setLoading(false));
  }, [lang]);

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) {
      setFamily(null);
      setError(null);
      setLoading(false);
      return;
    }
    load();
  }, [authReady, isAuthenticated, load]);

  return { family, loading, error, reload: load };
}
