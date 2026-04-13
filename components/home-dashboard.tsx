"use client";

import { useCallback, useEffect, useState } from "react";
import type { FamilyWithProfiles } from "@/types/family";
import { useTelegramSession } from "@/context/telegram-session-context";
import { FamilySwitcher } from "@/components/family-switcher";
import { AnalysesPreview } from "@/components/analyses-preview";
import { AddMemberModal } from "@/components/add-member-modal";
import { PaywallModal } from "@/components/paywall-modal";
import { UploadAnalysisModal } from "@/components/upload-analysis-modal";
import { useActiveProfile } from "@/context/active-profile-context";

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

export function HomeDashboard() {
  const { authReady, isAuthenticated, state } = useTelegramSession();
  const { activeProfileId } = useActiveProfile();
  const [family, setFamily] = useState<FamilyWithProfiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [analysesRefresh, setAnalysesRefresh] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetch("/api/family/default", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) {
          throw new Error("Кирүү талап кылынат. Telegram аркылуу ачыңыз.");
        }
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? r.statusText);
        }
        return r.json() as Promise<FamilyWithProfiles>;
      })
      .then((raw) => setFamily(normalizeFamily(raw)))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Ката");
        setFamily(null);
      })
      .finally(() => setLoading(false));
  }, []);

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
  const viewerName =
    state.status === "authenticated" ? state.viewer.displayName : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-6">
      <header className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-800/80">
          Emerald Kyrgyzstan
        </p>
        <h1 className="text-2xl font-semibold text-emerald-950">Dashboard</h1>
        {viewerName ? (
          <p className="text-sm font-medium text-emerald-900">Салам, {viewerName}</p>
        ) : null}
        <p className="text-sm text-emerald-900/70">
          Активдүү профиль боюнча анализдер жана үй-бүлө мүчөлөрү.
        </p>
      </header>

      {authReady && !isAuthenticated ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-emerald-950">
          <p className="font-medium">Кирүү: Telegram Mini App</p>
          <p className="mt-1 text-emerald-900/80">
            Колдонмону Telegram ичинен ачыңыз. Серверде{" "}
            <code className="rounded bg-white/60 px-1">TELEGRAM_BOT_TOKEN</code>{" "}
            коюлган болушу керек.
          </p>
          {process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true" ? (
            <p className="mt-2 text-xs text-emerald-800/90">
              Dev:{" "}
              <code className="rounded bg-white/60 px-1">ALLOW_DEV_LOGIN=true</code> жана{" "}
              <code className="rounded bg-white/60 px-1">NEXT_PUBLIC_ALLOW_DEV_LOGIN=true</code>{" "}
              — браузерден сынак.
            </p>
          ) : null}
          {state.status === "unauthenticated" && state.reason ? (
            <p className="mt-2 text-xs text-coral">Ката: {state.reason}</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-emerald-950">
          {error}
        </p>
      ) : null}

      {!authReady || (isAuthenticated && loading) ? (
        <p className="text-sm text-emerald-900/70">Жүктөлүүдө…</p>
      ) : null}

      {isAuthenticated && !loading && family ? (
        <>
          {family.tier !== "PREMIUM" ? (
            <button
              type="button"
              onClick={() => setPaywallOpen(true)}
              className="w-full rounded-2xl border border-amber-500/60 bg-amber-500/15 px-3 py-2 text-sm font-medium text-emerald-950"
            >
              Premium: безлимит анализов и семейных профилей
            </button>
          ) : null}
          <FamilySwitcher
            profiles={family.profiles}
            canAddMember={!!admin}
            onAddMember={admin ? () => setAddOpen(true) : undefined}
          />
          {activeProfileId ? (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="w-full rounded-2xl border-2 border-emerald-800/30 bg-emerald-900 py-3 text-center text-sm font-semibold text-mint shadow-md transition-opacity hover:opacity-95"
            >
              Анализ жүктөө
            </button>
          ) : null}
          <AnalysesPreview profiles={family.profiles} refreshKey={analysesRefresh} />
        </>
      ) : null}

      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={load}
      />

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

      <section
        className="rounded-2xl bg-emerald-900 p-4 text-mint shadow-lg"
        aria-label="Brand color sample"
      >
        <p className="text-sm font-medium text-amber-500">bg-emerald-900</p>
        <p className="mt-1 text-xs text-mint/90">
          Тема түсү конфигден тартылды (#00695C).
        </p>
      </section>
    </div>
  );
}
