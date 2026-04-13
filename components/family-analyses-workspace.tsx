"use client";

import { useCallback, useEffect, useState } from "react";
import type { FamilyWithProfiles } from "@/types/family";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useLanguage } from "@/context/language-context";
import { FamilySwitcher } from "@/components/family-switcher";
import { AnalysesPreview } from "@/components/analyses-preview";
import { AddMemberModal } from "@/components/add-member-modal";
import { PaywallModal } from "@/components/paywall-modal";
import { UploadAnalysisModal } from "@/components/upload-analysis-modal";
import { useActiveProfile } from "@/context/active-profile-context";
import { t } from "@/lib/i18n";
import { seedDemoLabRecord } from "@/app/actions/demo-lab";

function normalizeFamily(raw: unknown): FamilyWithProfiles {
  const f = raw as FamilyWithProfiles;
  return {
    ...f,
    profiles: f.profiles.map((p) => ({
      ...p,
      dateOfBirth:
        p.dateOfBirth == null
          ? null
          : typeof p.dateOfBirth === "string"
            ? p.dateOfBirth
            : new Date(p.dateOfBirth as unknown as Date).toISOString(),
    })),
  };
}

type Props = {
  /** Показывать CTA Premium (главная). */
  showPremiumCta?: boolean;
  /** Кнопка «Демо-анализ» (мок без файла) — для Vercel / быстрый тест графика. */
  showDemoSeedButton?: boolean;
  /** Компактная кнопка загрузки (главная). */
  compactUpload?: boolean;
};

export function FamilyAnalysesWorkspace({
  showPremiumCta = true,
  showDemoSeedButton = true,
  compactUpload = false,
}: Props) {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated } = useTelegramSession();
  const { activeProfileId } = useActiveProfile();
  const [family, setFamily] = useState<FamilyWithProfiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [analysesRefresh, setAnalysesRefresh] = useState(0);
  const [demoPending, setDemoPending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetch("/api/family/default", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) {
          throw new Error(t(lang, "dashboard.authRequired"));
        }
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? r.statusText);
        }
        return r.json() as Promise<FamilyWithProfiles>;
      })
      .then((raw) => setFamily(normalizeFamily(raw)))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : t(lang, "dashboard.errorPrefix") + " …");
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

  const admin = family?.profiles.find((p) => p.familyRole === "ADMIN");

  if (!authReady || !isAuthenticated) {
    return null;
  }

  if (loading) {
    return <p className="text-sm text-emerald-900/70">{t(lang, "analyses.loading")}</p>;
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-emerald-950">
        {error}
      </p>
    );
  }

  if (!family) {
    return null;
  }

  return (
    <>
      {showPremiumCta && family.tier !== "PREMIUM" ? (
        <button
          type="button"
          onClick={() => setPaywallOpen(true)}
          className="w-full rounded-2xl border border-amber-500/60 bg-amber-500/15 px-3 py-2 text-sm font-medium text-emerald-950"
        >
          {t(lang, "dashboard.premiumCta")}
        </button>
      ) : null}

      <FamilySwitcher
        profiles={family.profiles}
        canAddMember={!!admin}
        onAddMember={admin ? () => setAddOpen(true) : undefined}
      />

      {activeProfileId ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className={
              compactUpload
                ? "w-full rounded-2xl border-2 border-emerald-800/30 bg-emerald-900 py-3 text-center text-sm font-semibold text-mint shadow-md transition-opacity hover:opacity-95"
                : "w-full rounded-2xl border-2 border-emerald-800/30 bg-emerald-900 py-4 text-center text-base font-semibold text-mint shadow-md transition-opacity hover:opacity-95"
            }
          >
            {compactUpload ? t(lang, "dashboard.upload") : t(lang, "tests.uploadBig")}
          </button>
          {showDemoSeedButton ? (
            <button
              type="button"
              disabled={demoPending}
              onClick={() => {
                setDemoPending(true);
                void seedDemoLabRecord(activeProfileId)
                  .then((r) => {
                    if (r.ok) setAnalysesRefresh((k) => k + 1);
                  })
                  .finally(() => setDemoPending(false));
              }}
              className="w-full rounded-2xl border border-emerald-800/40 bg-white py-3 text-center text-sm font-medium text-emerald-900 shadow-sm disabled:opacity-50"
            >
              {demoPending ? "…" : t(lang, "tests.demoSeed")}
            </button>
          ) : null}
        </div>
      ) : null}

      <AnalysesPreview profiles={family.profiles} refreshKey={analysesRefresh} />

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />

      {activeProfileId ? (
        <UploadAnalysisModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          profileId={activeProfileId}
          onSuccess={() => setAnalysesRefresh((k) => k + 1)}
        />
      ) : null}

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onActivated={load}
      />
    </>
  );
}
