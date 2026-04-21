"use client";

import { useCallback, useEffect, useState } from "react";
import { BiologicalSex } from "@prisma/client";
import type { FamilyWithProfiles } from "@/types/family";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useLanguage } from "@/context/language-context";
import { FamilySwitcher } from "@/components/family-switcher";
import { AnalysisSkeleton } from "@/components/analysis-skeleton";
import { AnalysesPreview } from "@/components/analyses-preview";
import { AddMemberModal } from "@/components/add-member-modal";
import { PaywallModal } from "@/components/paywall-modal";
import { UploadAnalysisModal } from "@/components/upload-analysis-modal";
import { UploadHealthDocumentModal } from "@/components/upload-health-document-modal";
import { useActiveProfile } from "@/context/active-profile-context";
import { t } from "@/lib/i18n";
import { UploadFab } from "@/components/upload-fab";

function normalizeFamily(raw: unknown): FamilyWithProfiles {
  const f = raw as FamilyWithProfiles;
  return {
    ...f,
    profiles: f.profiles.map((p) => ({
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
  /** Вкладка «Динамика»: без Health Hub, только сравнение и графики. */
  variant?: "default" | "trends";
  /** Не показывать свитчер семьи (родитель — в шапке страницы). */
  hideFamilySwitcher?: boolean;
  /** Управление модалкой «Добавить члена» снаружи (кнопка + в шапке). */
  addMemberModalOpen?: boolean;
  onAddMemberModalOpenChange?: (open: boolean) => void;
  /** Скрыть заголовок/подпись блока архива внутри AnalysesPreview. */
  hidePreviewHeader?: boolean;
};

export function FamilyAnalysesWorkspace({
  showPremiumCta = true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compactUpload: _compactUpload = false,
  onAnalysesChanged,
  variant = "default",
  hideFamilySwitcher = false,
  addMemberModalOpen: addMemberModalOpenProp,
  onAddMemberModalOpenChange,
  hidePreviewHeader = false,
}: Props) {
  const isTrends = variant === "trends";
  const { lang } = useLanguage();
  const { authReady, isAuthenticated } = useTelegramSession();
  const { activeProfileId } = useActiveProfile();
  const [family, setFamily] = useState<FamilyWithProfiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpenInternal, setAddOpenInternal] = useState(false);
  const addModalControlled = typeof onAddMemberModalOpenChange === "function";
  const addOpen = addModalControlled ? Boolean(addMemberModalOpenProp) : addOpenInternal;
  const setAddOpen = (open: boolean) => {
    if (addModalControlled) onAddMemberModalOpenChange(open);
    else setAddOpenInternal(open);
  };
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
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

      {hideFamilySwitcher ? null : (
        <FamilySwitcher
          profiles={family.profiles}
          canAddMember={!!admin}
          onAddMember={admin ? () => setAddOpen(true) : undefined}
        />
      )}

      {/* Подсказка + кнопка «Добавить члена» (компактная) */}
      {activeProfileId ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
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
          {!isTrends ? (
            <p className="text-[11px] text-health-text-secondary">
              {lang === "ru"
                ? "Загрузка файлов доступна через кнопку + внизу экрана."
                : "Файл жүктөө төмөнкү + баскычы аркылуу жеткиликтүү."}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* FAB: плавающая кнопка загрузки (мобилка) */}
      {activeProfileId ? (
        <UploadFab
          onClick={() => setUploadMenuOpen(true)}
          mobileOnly={false}
        />
      ) : null}

      {uploadMenuOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/45 p-4 sm:items-center"
          role="dialog"
          aria-modal
        >
          <button
            type="button"
            aria-label="close"
            className="absolute inset-0"
            onClick={() => setUploadMenuOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-health-border/80">
            <h3 className="font-manrope text-base font-semibold text-health-text">
              {lang === "ru" ? "Выберите тип загрузки" : "Жүктөө түрүн тандаңыз"}
            </h3>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                className="min-h-[48px] w-full rounded-2xl bg-health-primary px-4 py-2 text-caption font-semibold text-white"
                onClick={() => {
                  setUploadMenuOpen(false);
                  setUploadOpen(true);
                }}
              >
                {lang === "ru" ? "Анализ с расшифровкой (ИИ)" : "ИИ менен анализ"}
              </button>
              <button
                type="button"
                className="min-h-[48px] w-full rounded-2xl bg-white px-4 py-2 text-caption font-semibold text-health-text ring-1 ring-health-border/80"
                onClick={() => {
                  setUploadMenuOpen(false);
                  setUploadDocOpen(true);
                }}
              >
                {lang === "ru" ? "Сохранить документ(ы)" : "Документ(тер) сактоо"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AnalysesPreview
        profiles={family.profiles}
        refreshKey={analysesRefresh}
        onRequestUpload={() => setUploadOpen(true)}
        mode={isTrends ? "trends" : "default"}
        archiveNeutral={!isTrends}
        hideHeader={hidePreviewHeader}
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
        <>
          <UploadAnalysisModal
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            profileId={activeProfileId}
            onSuccess={() => {
              setAnalysesRefresh((k) => k + 1);
              onAnalysesChanged?.();
            }}
          />
          <UploadHealthDocumentModal
            open={uploadDocOpen}
            onClose={() => setUploadDocOpen(false)}
            profileId={activeProfileId}
            onSuccess={() => {
              setAnalysesRefresh((k) => k + 1);
              onAnalysesChanged?.();
            }}
          />
        </>
      ) : null}

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onActivated={load}
      />
    </>
  );
}
