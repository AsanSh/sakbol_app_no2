"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, Plus } from "lucide-react";
import { FamilyRole } from "@prisma/client";
import { AddMemberModal } from "@/components/add-member-modal";
import { FamilySwitcher } from "@/components/family-switcher";
import { BottomSheet } from "@/components/sakbol/bottom-sheet";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { UploadAnalysisModal } from "@/components/upload-analysis-modal";
import { useActiveProfile } from "@/context/active-profile-context";
import { useAnalysesRefresh } from "@/context/analyses-refresh-context";
import { useTabApp } from "@/context/tab-app-context";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useDeviceType } from "@/hooks/use-device-type";
import type { FamilyWithProfiles } from "@/types/family";
import type { ParsedBiomarker } from "@/types/biomarker";
import { ProfileNotificationsContent } from "@/components/profile/profile-settings-sheets";
import { DoctorDiscoveryHome } from "@/features/home/doctor-discovery-home";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  family: FamilyWithProfiles | null;
  reloadFamily: () => void;
};

type AnalysisApiRow = {
  id: string;
  title: string | null;
  data: { biomarkers?: ParsedBiomarker[] };
  createdAt: string;
};

export function HomeTab({ family, reloadFamily }: Props) {
  const searchParams = useSearchParams();
  const doctorCat = searchParams.get("doctorCat");
  const { lang } = useLanguage();
  const device = useDeviceType();
  const isDesktopWeb = device === "desktop-web";
  const { state, authReady, isAuthenticated } = useTelegramSession();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisApiRow | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const { activeProfileId } = useActiveProfile();
  const { bumpAnalyses } = useAnalysesRefresh();
  const { setTab } = useTabApp();

  const effectiveProfileId =
    activeProfileId ?? family?.profiles.find((p) => !p.isSharedGuest)?.id ?? null;

  const loadLatestAnalysis = useCallback(() => {
    if (!effectiveProfileId) {
      setLatestAnalysis(null);
      return;
    }
    setAnalysisLoading(true);
    void fetch(`/api/analyses?profileId=${encodeURIComponent(effectiveProfileId)}`, {
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) return null;
        const j = (await r.json()) as { analyses?: AnalysisApiRow[] };
        const first = j.analyses?.[0];
        setLatestAnalysis(first ?? null);
      })
      .catch(() => setLatestAnalysis(null))
      .finally(() => setAnalysisLoading(false));
  }, [effectiveProfileId]);

  useEffect(() => {
    loadLatestAnalysis();
  }, [loadLatestAnalysis]);

  const admin = useMemo(
    () => family?.profiles.find((p) => p.familyRole === FamilyRole.ADMIN),
    [family?.profiles],
  );

  const headerSwitcher =
    authReady && isAuthenticated && family?.profiles?.length ? (
      <FamilySwitcher
        variant="header"
        profiles={family.profiles}
        canAddMember={!!admin}
        onAddMember={admin ? () => setAddMemberOpen(true) : undefined}
        joinFamilyHref="/join-family"
      />
    ) : null;

  const sharedSheets = (
    <BottomSheet open={notificationsOpen} title="Уведомления" onClose={() => setNotificationsOpen(false)}>
      <ProfileNotificationsContent />
    </BottomSheet>
  );

  const authBanner = (
    <>
      {authReady && !isAuthenticated ? (
        <div className="rounded-2xl bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/80">
          <p className="font-semibold">{t(lang, "dashboard.authTitle")}</p>
          <p className="mt-1 text-caption text-amber-900/90">
            {state.status === "unauthenticated" && state.reason === "web_login_required"
              ? "Сессия не найдена. Откройте вход: код из Telegram или email и пароль."
              : state.status === "unauthenticated" && state.reason === "no_init_data"
                ? t(lang, "dashboard.authBodyNoTg")
                : state.status === "unauthenticated" && state.reason === "telegram_init_data_missing"
                  ? t(lang, "dashboard.tgLoginHint")
                  : t(lang, "dashboard.authBody")}
          </p>
          {state.status === "unauthenticated" &&
          (state.reason === "web_login_required" || state.reason === "telegram_init_data_missing") ? (
            <Link
              href="/login"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-health-text px-4 py-2 text-caption font-semibold text-health-surface"
            >
              Войти на сайте
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const dashboardCtaAndWidget = (
    <div className="rounded-3xl bg-white p-4 shadow-ui-card">
      <p className="text-caption font-bold uppercase tracking-wide text-health-text-secondary">
        {t(lang, "home.healthStatusTitle")}
      </p>
      {analysisLoading ? (
        <p className="mt-3 text-sm text-health-text-secondary">{t(lang, "analyses.loading")}</p>
      ) : latestAnalysis?.data.biomarkers?.length ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-health-text-secondary">
            {t(lang, "home.healthStatusLatest")}
            {latestAnalysis.title ? ` · ${latestAnalysis.title}` : ""}
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl bg-slate-50/80 px-3 py-1">
            {latestAnalysis.data.biomarkers.slice(0, 6).map((b) => (
              <li
                key={`${b.biomarker}-${b.value}`}
                className="flex justify-between gap-2 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium text-health-text">{b.biomarker}</span>
                <span className="shrink-0 font-mono text-health-primary">
                  {b.value} {b.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-health-text-secondary">
          {t(lang, "home.healthStatusEmpty")}
        </p>
      )}
      <button
        type="button"
        disabled={!effectiveProfileId || !isAuthenticated}
        onClick={() => setUploadOpen(true)}
        className={cn(
          "mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-semibold text-white shadow-md shadow-teal-900/15 transition-[filter] hover:brightness-[1.05] active:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
          "bg-gradient-to-br from-health-primary via-teal-700 to-teal-900",
        )}
      >
        <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
        {t(lang, "home.addDocumentCta")}
      </button>
      <button
        type="button"
        onClick={() => setTab("insights")}
        className="mt-3 flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-health-primary transition-colors hover:bg-slate-100/90"
      >
        {t(lang, "home.openInsights")}
        <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      </button>
    </div>
  );

  if (isDesktopWeb) {
    return (
      <div className={cn("flex min-h-0 w-full flex-1 flex-col overflow-y-auto")}>
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-8 pt-2 md:px-6">
          {authBanner}
          {isAuthenticated && effectiveProfileId ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
              {dashboardCtaAndWidget}
              <DoctorDiscoveryHome isDesktop initialCategorySlug={doctorCat} />
            </div>
          ) : (
            <DoctorDiscoveryHome isDesktop initialCategorySlug={doctorCat} />
          )}
        </div>
        <AddMemberModal
          open={addMemberOpen}
          onClose={() => setAddMemberOpen(false)}
          onCreated={() => {
            reloadFamily();
            setAddMemberOpen(false);
          }}
          familyProfilesForInvite={(family?.profiles ?? []).filter((p) => !p.isSharedGuest)}
        />
        {effectiveProfileId ? (
          <UploadAnalysisModal
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            profileId={effectiveProfileId}
            onSuccess={() => {
              bumpAnalyses();
              loadLatestAnalysis();
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full">
      <SakbolTopBar
        showBell
        bellUnread
        onBell={() => setNotificationsOpen(true)}
        centerSlot={headerSwitcher}
      />
      <motion.div
        className="mx-auto max-w-2xl space-y-6 px-4 pb-6 pt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {authBanner}
        {dashboardCtaAndWidget}
        {sharedSheets}
        <AddMemberModal
          open={addMemberOpen}
          onClose={() => setAddMemberOpen(false)}
          onCreated={() => {
            reloadFamily();
            setAddMemberOpen(false);
          }}
          familyProfilesForInvite={(family?.profiles ?? []).filter((p) => !p.isSharedGuest)}
        />
        {effectiveProfileId ? (
          <UploadAnalysisModal
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            profileId={effectiveProfileId}
            onSuccess={() => {
              bumpAnalyses();
              loadLatestAnalysis();
            }}
          />
        ) : null}
      </motion.div>
    </div>
  );
}
