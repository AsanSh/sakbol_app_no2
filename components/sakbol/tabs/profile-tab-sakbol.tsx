"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BiologicalSex, ManagedRelationRole } from "@prisma/client";
import { ChevronDown } from "lucide-react";
import { AddMemberModal } from "@/components/add-member-modal";
import { CopyIdButton } from "@/components/copy-id-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import { BottomSheet } from "@/components/sakbol/bottom-sheet";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useLanguage } from "@/context/language-context";
import { useActiveProfile } from "@/context/active-profile-context";
import { useTelegramSession } from "@/context/telegram-session-context";
import type { FamilyWithProfiles, ProfileSummary } from "@/types/family";
import { t, type Lang } from "@/lib/i18n";
import { ProfileAvatar } from "@/components/ui/avatar";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import {
  updateMemberProfileBasics,
  updateOwnProfileBasics,
  updateProfileBiologicalSex,
  updateProfileVitals,
} from "@/app/actions/profile";
import { updateManagedProfileKinship } from "@/app/actions/family";
import { profileKinshipLabelRu } from "@/lib/profile-kinship";
import { ageYearsFromIsoDob } from "@/lib/risk-scores";
import { cn } from "@/lib/utils";

const PROFILE_EXTRAS_STORAGE_KEY = "sakbol.profile.extras.v1";

type ProfileExtras = {
  heightCm?: number;
  weightKg?: number;
  bloodType?: string;
};

const KINSHIP_OPTIONS: { value: ManagedRelationRole; label: string }[] = [
  { value: ManagedRelationRole.CHILD, label: "Ребёнок (пол: сын / дочь)" },
  { value: ManagedRelationRole.SPOUSE, label: "Супруг(а)" },
  { value: ManagedRelationRole.ELDER, label: "Родитель / старшее поколение" },
  { value: ManagedRelationRole.OTHER, label: "Другой родственник" },
];

function FamilyMemberEditableCard({
  profile,
  lang,
  viewerId,
  viewerIsAdmin,
  canEdit,
  expanded,
  onToggle,
  onReload,
  syncViewerFromServer,
}: {
  profile: ProfileSummary;
  lang: Lang;
  viewerId: string;
  viewerIsAdmin: boolean;
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onReload: () => void;
  syncViewerFromServer: () => Promise<void>;
}) {
  const ageFromDob = profile.dateOfBirth ? ageYearsFromIsoDob(profile.dateOfBirth) : null;

  const [name, setName] = useState(profile.displayName);
  const [ageStr, setAgeStr] = useState(ageFromDob != null ? String(ageFromDob) : "");
  const [heightStr, setHeightStr] = useState(
    typeof profile.heightCm === "number" ? String(profile.heightCm) : "",
  );
  const [weightStr, setWeightStr] = useState(
    typeof profile.weightKg === "number" ? String(profile.weightKg) : "",
  );
  const [blood, setBlood] = useState(profile.bloodType?.trim() ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const a = profile.dateOfBirth ? ageYearsFromIsoDob(profile.dateOfBirth) : null;
    setName(profile.displayName);
    setAgeStr(a != null ? String(a) : "");
    setHeightStr(typeof profile.heightCm === "number" ? String(profile.heightCm) : "");
    setWeightStr(typeof profile.weightKg === "number" ? String(profile.weightKg) : "");
    setBlood(profile.bloodType?.trim() ?? "");
    setErr(null);
  }, [
    profile.id,
    profile.displayName,
    profile.dateOfBirth,
    profile.heightCm,
    profile.weightKg,
    profile.bloodType,
  ]);

  const hNum = Number.parseFloat(heightStr);
  const wNum = Number.parseFloat(weightStr);
  const bmiPreview =
    Number.isFinite(hNum) && Number.isFinite(wNum) && hNum > 0 && wNum > 0
      ? (wNum / Math.pow(hNum / 100, 2)).toFixed(1)
      : null;

  const onSave = async () => {
    setErr(null);
    setSaving(true);
    try {
      const h = Number.parseFloat(heightStr);
      const w = Number.parseFloat(weightStr);
      const vitalsRes = await updateProfileVitals(profile.id, {
        heightCm: Number.isFinite(h) && h > 0 ? h : null,
        weightKg: Number.isFinite(w) && w > 0 ? w : null,
        bloodType: blood.trim() || null,
      });
      if (!vitalsRes.ok) {
        setErr(vitalsRes.error);
        return;
      }

      const ageYearsRaw = ageStr.trim();
      const ageParsed = ageYearsRaw === "" ? null : Number.parseInt(ageYearsRaw, 10);
      const ageYears =
        ageParsed != null && Number.isFinite(ageParsed) ? ageParsed : null;
      const basicsRes =
        profile.id === viewerId
          ? await updateOwnProfileBasics({ displayName: name, ageYears })
          : await updateMemberProfileBasics(profile.id, { displayName: name, ageYears });
      if (!basicsRes.ok) {
        setErr(basicsRes.error);
        return;
      }

      if (profile.id === viewerId) {
        await syncViewerFromServer();
      }
      onReload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <li
      className={cn(
        "rounded-2xl border text-sm shadow-sm",
        profile.familyRole === "ADMIN"
          ? "border-amber-400/70 bg-gradient-to-br from-amber-100/90 via-amber-50/80 to-orange-50/90"
          : "border-sky-400/70 bg-gradient-to-br from-sky-100/90 via-sky-50/80 to-indigo-50/90",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left transition-colors hover:bg-black/[0.03] rounded-2xl"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-semibold text-[#191c1d]">{profile.displayName}</span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide",
              profile.familyRole === "ADMIN"
                ? "bg-amber-300 text-amber-950 shadow-inner ring-1 ring-amber-600/40"
                : "bg-sky-300 text-sky-950 shadow-inner ring-1 ring-sky-600/40",
            )}
          >
            {profileKinshipLabelRu(profile)}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-[#40484c] transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden
          strokeWidth={2}
        />
      </button>

      {expanded ? (
        <>
          <div className="border-t border-[#191c1d]/10 px-3 pb-2 pt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#70787d]">
            <span>
              {t(lang, "profile.clinicalIdShort")}: {formatClinicalAnonymId(profile.id)}
            </span>
            <CopyIdButton text={formatClinicalAnonymId(profile.id)} label={t(lang, "profile.copyId")} />
          </div>

      {canEdit ? (
        <div className="space-y-2 border-t border-[#191c1d]/10 px-3 pb-3 pt-2">
          <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
            <span>Имя в приложении</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-[#e7e8e9] bg-white px-2 py-1.5 text-xs text-[#191c1d]"
              autoComplete="name"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
            <span>Возраст (полных лет)</span>
            <input
              value={ageStr}
              onChange={(e) => setAgeStr(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              className="rounded-lg border border-[#e7e8e9] bg-white px-2 py-1.5 text-xs text-[#191c1d]"
              placeholder="Необязательно"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
              <span>Рост, см</span>
              <input
                value={heightStr}
                onChange={(e) => setHeightStr(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                className="rounded-lg border border-[#e7e8e9] bg-white px-2 py-1.5 text-xs text-[#191c1d]"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
              <span>Вес, кг</span>
              <input
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                className="rounded-lg border border-[#e7e8e9] bg-white px-2 py-1.5 text-xs text-[#191c1d]"
              />
            </label>
          </div>
          <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
            <span>Группа крови</span>
            <input
              value={blood}
              onChange={(e) => setBlood(e.target.value.slice(0, 32))}
              className="rounded-lg border border-[#e7e8e9] bg-white px-2 py-1.5 text-xs text-[#191c1d]"
              placeholder="Например O(I)+"
            />
          </label>
          <p className="text-[10px] text-[#70787d]">BMI (по полям выше): {bmiPreview ?? "—"}</p>
          <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
            <span>{t(lang, "profile.biologicalSex")}</span>
            <select
              className="rounded-lg border border-[#e7e8e9] bg-white px-2 py-1.5 text-xs text-[#191c1d]"
              value={profile.biologicalSex}
              onChange={(e) => {
                const v = e.target.value as BiologicalSex;
                void updateProfileBiologicalSex(profile.id, v).then(() => onReload());
              }}
            >
              <option value={BiologicalSex.UNKNOWN}>{t(lang, "profile.sexUnknown")}</option>
              <option value={BiologicalSex.MALE}>{t(lang, "profile.sexMale")}</option>
              <option value={BiologicalSex.FEMALE}>{t(lang, "profile.sexFemale")}</option>
            </select>
          </label>
          {profile.isManaged && viewerIsAdmin ? (
            <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
              <span>Родство в семье</span>
              <select
                className="rounded-lg border border-[#e7e8e9] bg-white px-2 py-1.5 text-xs text-[#191c1d]"
                value={profile.managedRole ?? ManagedRelationRole.OTHER}
                onChange={(e) => {
                  const v = e.target.value as ManagedRelationRole;
                  void updateManagedProfileKinship(profile.id, v).then((res) => {
                    if (res.ok) onReload();
                    else setErr(res.error);
                  });
                }}
              >
                {KINSHIP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {err ? (
            <p className="text-[11px] text-red-600" role="alert">
              {err}
            </p>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="w-full rounded-lg bg-[#004253] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Сохранение…" : "Сохранить данные"}
          </button>
        </div>
      ) : (
        <div className="border-t border-[#191c1d]/10 px-3 pb-3 pt-2">
          <p className="text-[11px] text-[#70787d]">
            {t(lang, "profile.biologicalSex")}:{" "}
            {profile.biologicalSex === BiologicalSex.MALE
              ? t(lang, "profile.sexMale")
              : profile.biologicalSex === BiologicalSex.FEMALE
                ? t(lang, "profile.sexFemale")
                : t(lang, "profile.sexUnknown")}
          </p>
        </div>
      )}
        </>
      ) : null}
    </li>
  );
}

type Props = {
  family: FamilyWithProfiles | null;
  loading: boolean;
  reload: () => void;
};

export function ProfileTabSakbol({ family, loading, reload }: Props) {
  const { lang } = useLanguage();
  const { activeProfileId } = useActiveProfile();
  const { authReady, isAuthenticated, state, syncViewerFromServer } = useTelegramSession();
  const [addOpen, setAddOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  /** Аккордеон семьи: открыта только одна карточка. */
  const [openFamilyCardId, setOpenFamilyCardId] = useState<string | null>(null);
  const localVitalsMigratedRef = useRef(false);

  const viewer = state.status === "authenticated" ? state.viewer : null;
  const admin = family?.profiles.find((p) => p.familyRole === "ADMIN");
  const viewerOwnProfile = viewer ? family?.profiles.find((p) => p.id === viewer.id) : null;

  const editTarget = useMemo(() => {
    if (!family?.profiles?.length || !viewer) return null;
    const id =
      activeProfileId && family.profiles.some((p) => p.id === activeProfileId)
        ? activeProfileId
        : viewer.id;
    return family.profiles.find((p) => p.id === id) ?? null;
  }, [family, viewer, activeProfileId]);

  const age = editTarget?.dateOfBirth ? ageYearsFromIsoDob(editTarget.dateOfBirth) : null;

  const canEditMember = (profileId: string) => {
    if (!viewer) return false;
    if (viewer.id === profileId) return true;
    return viewer.familyRole === "ADMIN";
  };

  const clinical = editTarget ? formatClinicalAnonymId(editTarget.id) : viewer ? formatClinicalAnonymId(viewer.id) : "—";

  useEffect(() => {
    if (typeof window === "undefined" || localVitalsMigratedRef.current) return;
    if (!viewer?.id || !viewerOwnProfile) return;

    const hasServer =
      viewerOwnProfile.heightCm != null ||
      viewerOwnProfile.weightKg != null ||
      Boolean(viewerOwnProfile.bloodType?.trim());

    if (hasServer) {
      localVitalsMigratedRef.current = true;
      return;
    }

    let local: ProfileExtras | undefined;
    try {
      const raw = window.localStorage.getItem(PROFILE_EXTRAS_STORAGE_KEY);
      if (!raw) {
        localVitalsMigratedRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, ProfileExtras>;
      local = parsed[viewer.id];
    } catch {
      return;
    }

    if (!local) {
      localVitalsMigratedRef.current = true;
      return;
    }

    const h = local.heightCm;
    const w = local.weightKg;
    const b = local.bloodType?.trim() || null;
    const hasLocal =
      (typeof h === "number" && h > 0) ||
      (typeof w === "number" && w > 0) ||
      Boolean(b);

    if (!hasLocal) {
      localVitalsMigratedRef.current = true;
      return;
    }

    localVitalsMigratedRef.current = true;
    void updateProfileVitals(viewer.id, {
      heightCm: typeof h === "number" && h > 0 ? h : null,
      weightKg: typeof w === "number" && w > 0 ? w : null,
      bloodType: b || null,
    }).then((res) => {
      if (res.ok) reload();
      else localVitalsMigratedRef.current = false;
    });
  }, [viewer?.id, viewerOwnProfile, reload]);

  const bmiFromProfile = (() => {
    const h = editTarget?.heightCm;
    const w = editTarget?.weightKg;
    if (typeof h !== "number" || typeof w !== "number" || h <= 0 || w <= 0) return null;
    const m = h / 100;
    return (w / (m * m)).toFixed(1);
  })();

  return (
    <div className="w-full">
      <SakbolTopBar />
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-4 pt-2">
        {!authReady ? (
          <p className="text-sm text-[#70787d]">{t(lang, "analyses.loading")}</p>
        ) : null}

        {authReady && !isAuthenticated ? (
          <div className="rounded-2xl border border-[#ffdcc0] bg-[#ffdcc0]/50 px-4 py-3 text-sm text-[#2d1600]">
            <p className="font-medium">{t(lang, "dashboard.authTitle")}</p>
            <p className="mt-1 text-xs text-[#693c08]">
              {state.status === "unauthenticated" && state.reason === "web_login_required"
                ? "Кирүү үчүн /login бетин ачыңыз же Telegram аркылуу кирүү."
                : state.status === "unauthenticated" && state.reason === "no_init_data"
                  ? t(lang, "dashboard.authBodyNoTg")
                  : state.status === "unauthenticated" && state.reason === "telegram_init_data_missing"
                    ? t(lang, "dashboard.authTelegramRetry")
                    : t(lang, "dashboard.authBody")}
            </p>
            {state.status === "unauthenticated" && state.reason === "web_login_required" ? (
              <Link
                href="/login"
                className="mt-3 inline-flex rounded-xl bg-[#5c3200] px-4 py-2 text-xs font-semibold text-[#ffead4]"
              >
                Кирүү
              </Link>
            ) : null}
            {state.status === "unauthenticated" &&
            state.reason &&
            state.reason !== "no_init_data" &&
            state.reason !== "telegram_init_data_missing" &&
            state.reason !== "web_login_required" ? (
              <p className="mt-2 rounded-lg bg-white/60 px-2 py-1.5 font-mono text-[10px] leading-snug text-[#5c3200]">
                {state.reason}
              </p>
            ) : null}
          </div>
        ) : null}

        {authReady && isAuthenticated && viewer ? (
          <>
            <div className="overflow-visible rounded-2xl bg-gradient-to-br from-[#004253] to-[#005b71] p-4 text-white shadow-lg">
              <div className="flex items-start gap-3">
                {(() => {
                  const url = editTarget?.avatarUrl ?? viewer.avatarUrl ?? null;
                  const displayName = editTarget?.displayName ?? viewer.displayName;
                  return (
                    <div className="flex shrink-0 items-center justify-center">
                      <ProfileAvatar
                        src={url}
                        name={displayName}
                        size={56}
                        className="border-2 border-white/70"
                      />
                    </div>
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#d4e6e9]">ID {clinical}</p>
                  <p className="font-manrope text-lg font-extrabold">
                    {editTarget?.displayName ?? viewer.displayName}
                  </p>
                  {editTarget && viewer && editTarget.id !== viewer.id ? (
                    <p className="mt-0.5 text-[10px] text-[#b7eaff]/90">
                      Активный профиль (анализы на главной) — карточка этого человека в блоке «Семья» ниже.
                    </p>
                  ) : null}
                  <p className="text-xs text-[#b7eaff]">
                    {age != null ? `${age} лет` : "Возраст не указан"} · Бишкек
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
                      BMI {bmiFromProfile ?? "—"}
                    </span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
                      Score 78
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPremiumOpen(true)}
              className="w-full rounded-2xl bg-gradient-to-r from-[#ffdcc0] to-[#ffead4] p-4 text-left shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 text-amber-700">
                  <MaterialIcon name="workspace_premium" className="text-[28px]" filled />
                </div>
                <div className="flex-1">
                  <p className="font-manrope font-bold text-[#2d1600]">Sakbol Premium</p>
                  <p className="text-xs text-[#693c08]">Безлимит анализов и семья</p>
                </div>
                <span className="rounded-full bg-[#5c3200] px-3 py-1.5 text-[11px] font-bold text-[#ffead4]">
                  Попробовать
                </span>
              </div>
            </button>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                {
                  icon: "height",
                  label: "Рост",
                  val:
                    typeof editTarget?.heightCm === "number"
                      ? `${editTarget.heightCm} см`
                      : "—",
                },
                {
                  icon: "monitor_weight",
                  label: "Вес",
                  val:
                    typeof editTarget?.weightKg === "number"
                      ? `${editTarget.weightKg} кг`
                      : "—",
                },
                { icon: "monitor_heart", label: "BMI", val: bmiFromProfile ?? "—" },
                {
                  icon: "bloodtype",
                  label: "Группа",
                  val: editTarget?.bloodType?.trim() || "—",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-[#e7e8e9] bg-white p-3 text-center shadow-sm"
                >
                  <MaterialIcon name={c.icon} className="mx-auto text-[#004253]" />
                  <p className="mt-1 text-[10px] text-[#70787d]">{c.label}</p>
                  <p className="font-manrope text-sm font-bold text-[#191c1d]">{c.val}</p>
                </div>
              ))}
            </div>

            <section
              id="profile-family-section"
              className="rounded-2xl border border-[#e7e8e9] bg-white p-4 shadow-sm scroll-mt-20"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-manrope text-sm font-bold text-[#191c1d]">
                  {t(lang, "profile.family")}
                </h2>
                {admin ? (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="rounded-full bg-[#004253] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {t(lang, "profile.addMember")}
                  </button>
                ) : null}
              </div>
              {loading ? (
                <p className="mt-3 text-sm text-[#70787d]">{t(lang, "analyses.loading")}</p>
              ) : family?.profiles?.length ? (
                <ul className="mt-3 space-y-2">
                  {family.profiles.map((p) => (
                    <FamilyMemberEditableCard
                      key={p.id}
                      profile={p}
                      lang={lang}
                      viewerId={viewer.id}
                      viewerIsAdmin={viewer.familyRole === "ADMIN"}
                      canEdit={canEditMember(p.id)}
                      expanded={openFamilyCardId === p.id}
                      onToggle={() => {
                        setOpenFamilyCardId((prev) => (prev === p.id ? null : p.id));
                      }}
                      onReload={reload}
                      syncViewerFromServer={syncViewerFromServer}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#70787d]">{t(lang, "profile.noProfiles")}</p>
              )}
            </section>

            <section className="rounded-2xl border border-[#e7e8e9] bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-[#191c1d]">{t(lang, "profile.language")}</h2>
              <p className="mt-1 text-xs text-[#70787d]">{t(lang, "profile.languageHint")}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm text-[#40484c]">RU / KG</span>
                <LanguageSwitcher />
              </div>
            </section>

            <ul className="space-y-1 rounded-2xl border border-[#e7e8e9] bg-white p-2 shadow-sm">
              {[
                {
                  label: "Личные данные",
                  onClick: () => {
                    document
                      .getElementById("profile-family-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  },
                  disabled: false,
                },
                { label: "Уведомления", onClick: () => setNotifyOpen(true), disabled: false },
                { label: "Конфиденциальность", onClick: () => setPrivacyOpen(true), disabled: false },
                { label: "Язык", onClick: () => {}, disabled: false },
                { label: "Поддержка", onClick: () => setSupportOpen(true), disabled: false },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    disabled={"disabled" in item ? item.disabled : false}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[#191c1d] hover:bg-[#f8f9fa]",
                      "disabled" in item && item.disabled ? "cursor-not-allowed opacity-45 hover:bg-transparent" : "",
                    )}
                  >
                    {item.label}
                    <MaterialIcon name="chevron_right" className="text-[#bfc8cc]" />
                  </button>
                </li>
              ))}
            </ul>

            <p className="text-center text-[10px] text-[#70787d]">
              Версия 0.1 · Кыргызстан 🇰🇬
            </p>
          </>
        ) : null}
      </div>

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />

      <BottomSheet open={premiumOpen} title="Premium" onClose={() => setPremiumOpen(false)}>
        <p className="text-sm text-[#40484c]">
          Месяц 299 сом / год 2 990 сом — безлимит загрузок и семейные профили (мок).
        </p>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-sakbol-cta py-3 font-semibold text-white shadow-sm shadow-coral/25 transition-[filter] hover:brightness-[1.04]"
        >
          Активировать
        </button>
      </BottomSheet>

      <BottomSheet open={notifyOpen} title="Уведомления" onClose={() => setNotifyOpen(false)}>
        <p className="text-sm text-[#40484c]">
          Этот раздел в разработке. В следующем релизе тут будут push- и Telegram-настройки.
        </p>
      </BottomSheet>

      <BottomSheet open={privacyOpen} title="Конфиденциальность" onClose={() => setPrivacyOpen(false)}>
        <p className="text-sm text-[#40484c]">
          Уже сейчас в PDF-выгрузках и предпросмотре анализов не используются ФИО, только псевдо-ID.
        </p>
      </BottomSheet>

      <BottomSheet open={supportOpen} title="Поддержка" onClose={() => setSupportOpen(false)}>
        <p className="text-sm text-[#40484c]">
          Если что-то не работает, напишите в поддержку и приложите скриншот + время события.
        </p>
      </BottomSheet>
    </div>
  );
}
