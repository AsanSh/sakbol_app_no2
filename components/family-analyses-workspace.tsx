"use client";

import { useCallback, useEffect, useState } from "react";
import { BiologicalSex } from "@prisma/client";
import type { FamilyWithProfiles } from "@/types/family";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useLanguage } from "@/context/language-context";
import { FamilySwitcher } from "@/components/family-switcher";
import { AnalysisSkeleton } from "@/components/analysis-skeleton";
import { AnalysesPreview } from "@/components/analyses-preview";
import { HealthHubPanel } from "@/components/health-hub-panel";
import { AddMemberModal } from "@/components/add-member-modal";
import { PaywallModal } from "@/components/paywall-modal";
import { UploadAnalysisModal } from "@/components/upload-analysis-modal";
import { useActiveProfile } from "@/context/active-profile-context";
import { t } from "@/lib/i18n";
import { UploadFab } from "@/components/upload-fab";

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
      heightCm: p.heightCm ?? null,
      weightKg: p.weightKg ?? null,
      bloodType: p.bloodType ?? null,
    })),
  };
}

type Props = {
  /** Показывать CTA Premium (главная). */
  showPremiumCta?: boolean;
  /** Компактная кнопка загрузки (главная). */
  compactUpload?: boolean;
  /** После загрузки / демо — обновить зависимые экраны (риски и т.д.). */
  onAnalysesChanged?: () => void;
  /** Инкремент открывает модалку загрузки (кнопка в шапке вкладки). */
  uploadSignal?: number;
  /** Вкладка «Динамика»: без Health Hub, только сравнение и графики. */
  variant?: "default" | "trends";
};

export function FamilyAnalysesWorkspace({
  showPremiumCta = true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compactUpload: _compactUpload = false,
  onAnalysesChanged,
  uploadSignal = 0,
  variant = "default",
}: Props) {
  const isTrends = variant === "trends";
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

  useEffect(() => {
    if (uploadSignal > 0) setUploadOpen(true);
  }, [uploadSignal]);

  const admin = family?.profiles.find((p) => p.familyRole === "ADMIN");

  if (!authReady || !isAuthenticated) {
    return null;
  }

  if (loading) {
    return <AnalysisSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50/90 px-4 py-3 text-sm text-red-900 shadow-sm ring-1 ring-red-200/80">
        {error}
      </div>
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
          className="w-full rounded-2xl bg-amber-50/95 px-4 py-3 text-sm font-semibold text-amber-950 shadow-sm ring-1 ring-amber-200/80 transition-all duration-300 hover:bg-amber-100/90"
        >
          {t(lang, "dashboard.premiumCta")}
        </button>
      ) : null}

      <FamilySwitcher
        profiles={family.profiles}
        canAddMember={!!admin}
        onAddMember={admin ? () => setAddOpen(true) : undefined}
      />

      {/* Подсказка + кнопка «Добавить члена» (компактная) */}
      {activeProfileId ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption text-health-text-secondary">{t(lang, "dashboard.quickUploadHint")}</p>
          {admin ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="shrink-0 rounded-xl bg-health-surface px-3 py-2 text-caption font-semibold text-health-primary shadow-sm ring-1 ring-health-border/80 transition-all duration-300 hover:shadow-md"
            >
              {t(lang, "family.addMemberShort")}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* FAB: плавающая кнопка загрузки (мобилка) */}
      {activeProfileId ? (
        <UploadFab onClick={() => setUploadOpen(true)} mobileOnly={false} />
      ) : null}

      {isTrends ? null : (
        <HealthHubPanel profiles={family.profiles} refreshKey={analysesRefresh} />
      )}

      <AnalysesPreview
        profiles={family.profiles}
        refreshKey={analysesRefresh}
        onRequestUpload={() => setUploadOpen(true)}
        mode={isTrends ? "trends" : "default"}
      />

      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          load();
          onAnalysesChanged?.();
        }}
      />

      {activeProfileId ? (
        <UploadAnalysisModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          profileId={activeProfileId}
          onSuccess={() => {
            setAnalysesRefresh((k) => k + 1);
            onAnalysesChanged?.();
          }}
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
