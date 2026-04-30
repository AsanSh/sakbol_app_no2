"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BiologicalSex, ManagedRelationRole, SubjectIdCountry } from "@prisma/client";
import { ChevronDown, Copy, FileDown, Loader2, Pill, Share2, Stethoscope, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { LinkTelegramCard } from "@/components/profile/link-telegram-card";
import {
  ProfileNotificationsContent,
  ProfilePrivacyContent,
  ProfileSupportForm,
} from "@/components/profile/profile-settings-sheets";
import { WebLoginPhoneCard } from "@/components/profile/web-login-phone-card";
import { AddMemberModal } from "@/components/add-member-modal";
import { CopyIdButton } from "@/components/copy-id-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import { BottomSheet } from "@/components/sakbol/bottom-sheet";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useLanguage } from "@/context/language-context";
import { useTabApp } from "@/context/tab-app-context";
import { useActiveProfile } from "@/context/active-profile-context";
import { useTelegramSession } from "@/context/telegram-session-context";
import type { FamilyWithProfiles, ProfileSummary } from "@/types/family";
import { t, type Lang } from "@/lib/i18n";
import { ProfileAvatar } from "@/components/ui/avatar";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import {
  updateMemberProfileBasics,
  updateOwnProfileBasics,
  updateOwnProfilePractitionerFlags,
  updateProfileBiologicalSex,
  updateProfileVitals,
} from "@/app/actions/profile";
import {
  deleteManagedProfile,
  updateManagedMemberSubjectId,
  updateManagedProfileKinship,
} from "@/app/actions/family";
import { setOwnProfilePin, updateOwnSubjectId } from "@/app/actions/profile-pin";
import { SubjectIdCountrySelect, SubjectIdNumberInput } from "@/components/subject-id-inputs";
import {
  isSubjectIdLengthSatisfied,
  SUBJECT_ID_COUNTRY_OPTIONS,
} from "@/lib/subject-id-country";
import { profileKinshipLabel } from "@/lib/profile-kinship";
import { downloadDoctorReportPdf } from "@/lib/client/download-doctor-report-pdf";
import { DoctorPatientsSection } from "@/features/doctor/my-patients-tab";
import { showPatientsTabForFamily } from "@/lib/show-patients-tab";
import { telegramBotUsernameFromEnv } from "@/lib/telegram-public-urls";
import { hapticImpact } from "@/lib/telegram-haptics";
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
  const [isPractitionerDoctor, setIsPractitionerDoctor] = useState(
    Boolean(profile.medCardIsDoctor),
  );
  const [isPractitionerCaregiver, setIsPractitionerCaregiver] = useState(
    Boolean(profile.medCardIsCaregiver),
  );
  const [practitionerDoctorNote, setPractitionerDoctorNote] = useState(
    profile.medCardDoctorNote?.trim() ?? "",
  );
  const [practitionerCaregiverNote, setPractitionerCaregiverNote] = useState(
    profile.medCardCaregiverNote?.trim() ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const showSubjectIdEditor =
    profile.id === viewerId || (profile.isManaged && viewerIsAdmin);
  const [sidCountry, setSidCountry] = useState<SubjectIdCountry>(
    profile.subjectIdCountry ?? SubjectIdCountry.KG,
  );
  const [sidDigits, setSidDigits] = useState("");
  const [sidBusy, setSidBusy] = useState(false);

  useEffect(() => {
    const a = profile.dateOfBirth ? ageYearsFromIsoDob(profile.dateOfBirth) : null;
    setName(profile.displayName);
    setAgeStr(a != null ? String(a) : "");
    setHeightStr(typeof profile.heightCm === "number" ? String(profile.heightCm) : "");
    setWeightStr(typeof profile.weightKg === "number" ? String(profile.weightKg) : "");
    setBlood(profile.bloodType?.trim() ?? "");
    setIsPractitionerDoctor(Boolean(profile.medCardIsDoctor));
    setIsPractitionerCaregiver(Boolean(profile.medCardIsCaregiver));
    setPractitionerDoctorNote(profile.medCardDoctorNote?.trim() ?? "");
    setPractitionerCaregiverNote(profile.medCardCaregiverNote?.trim() ?? "");
    setErr(null);
  }, [
    profile.id,
    profile.displayName,
    profile.dateOfBirth,
    profile.heightCm,
    profile.weightKg,
    profile.bloodType,
    profile.medCardIsDoctor,
    profile.medCardIsCaregiver,
    profile.medCardDoctorNote,
    profile.medCardCaregiverNote,
  ]);

  useEffect(() => {
    setSidCountry(profile.subjectIdCountry ?? SubjectIdCountry.KG);
    setSidDigits("");
  }, [profile.id, profile.subjectIdCountry]);

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
        const prRes = await updateOwnProfilePractitionerFlags({
          isDoctor: isPractitionerDoctor,
          isCaregiver: isPractitionerCaregiver,
          doctorNote: practitionerDoctorNote.trim() || null,
          caregiverNote: practitionerCaregiverNote.trim() || null,
        });
        if (!prRes.ok) {
          setErr(prRes.error);
          return;
        }
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
            {profileKinshipLabel(profile, lang)}
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
          {profile.id === viewerId ? (
            <div className="space-y-2 rounded-xl border border-[#cfe8ef] bg-[#f4fafb] px-2.5 py-2.5">
              <p className="text-[11px] font-semibold text-[#004253]">
                {t(lang, "profile.practitionerTitle")}
              </p>
              <p className="text-[10px] leading-snug text-[#40484c]">
                {t(lang, "profile.practitionerLead")}
              </p>
              <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[#191c1d]">
                <input
                  type="checkbox"
                  checked={isPractitionerDoctor}
                  onChange={(e) => setIsPractitionerDoctor(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#004253]"
                />
                <span>{t(lang, "profile.practitionerDoctor")}</span>
              </label>
              {isPractitionerDoctor ? (
                <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
                  <span>{t(lang, "profile.practitionerDoctorHint")}</span>
                  <textarea
                    value={practitionerDoctorNote}
                    onChange={(e) => setPractitionerDoctorNote(e.target.value.slice(0, 2000))}
                    rows={3}
                    className="resize-y rounded-lg border border-[#e7e8e9] bg-white px-2 py-1.5 text-xs text-[#191c1d]"
                  />
                </label>
              ) : null}
              <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[#191c1d]">
                <input
                  type="checkbox"
                  checked={isPractitionerCaregiver}
                  onChange={(e) => setIsPractitionerCaregiver(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#004253]"
                />
                <span>{t(lang, "profile.practitionerCaregiver")}</span>
              </label>
              {isPractitionerCaregiver ? (
                <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
                  <span>{t(lang, "profile.practitionerCaregiverHint")}</span>
                  <textarea
                    value={practitionerCaregiverNote}
                    onChange={(e) => setPractitionerCaregiverNote(e.target.value.slice(0, 2000))}
                    rows={3}
                    className="resize-y rounded-lg border border-[#e7e8e9] bg-white px-2 py-1.5 text-xs text-[#191c1d]"
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          {profile.id !== viewerId &&
          (profile.medCardIsDoctor || profile.medCardIsCaregiver) ? (
            <div className="space-y-1.5 rounded-xl border border-[#cfe8ef] bg-[#f4fafb] px-2.5 py-2.5 text-[11px] text-[#191c1d]">
              {profile.medCardIsDoctor ? (
                <p className="font-semibold text-[#004253]">
                  {t(lang, "profile.practitionerReadonlyDoctor")}
                </p>
              ) : null}
              {profile.medCardDoctorNote?.trim() ? (
                <p className="whitespace-pre-wrap text-[10px] leading-snug text-[#40484c]">
                  {profile.medCardDoctorNote.trim()}
                </p>
              ) : null}
              {profile.medCardIsCaregiver ? (
                <p className="font-semibold text-[#004253]">
                  {t(lang, "profile.practitionerReadonlyCaregiver")}
                </p>
              ) : null}
              {profile.medCardCaregiverNote?.trim() ? (
                <p className="whitespace-pre-wrap text-[10px] leading-snug text-[#40484c]">
                  {profile.medCardCaregiverNote.trim()}
                </p>
              ) : null}
            </div>
          ) : null}
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
          {showSubjectIdEditor ? (
            <div className="space-y-2 rounded-xl border border-[#e7e8e9] bg-[#fafbfb] px-2.5 py-2.5">
              <p className="text-[11px] font-semibold text-[#004253]">
                Гос. идентификатор (ИИН / ПИН / ПИНФЛ / СНИЛС)
              </p>
              {profile.hasSubjectId ? (
                <p className="text-[10px] leading-snug text-[#40484c]">
                  Привязан документ:{" "}
                  <strong>
                    {SUBJECT_ID_COUNTRY_OPTIONS.find((o) => o.value === profile.subjectIdCountry)
                      ?.label ?? "указан"}
                  </strong>
                  . Номер в открытом виде не хранится.
                </p>
              ) : (
                <p className="text-[10px] leading-snug text-[#40484c]">
                  Укажите страну и номер — в базе сохраняется только защищённый идентификатор.
                </p>
              )}
              <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
                <span>Страна</span>
                <SubjectIdCountrySelect
                  value={sidCountry}
                  onChange={setSidCountry}
                  disabled={sidBusy}
                  className="!rounded-lg !text-xs"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[11px] text-[#40484c]">
                <span>Номер (только цифры)</span>
                <SubjectIdNumberInput
                  country={sidCountry}
                  value={sidDigits}
                  onChange={setSidDigits}
                  disabled={sidBusy}
                  className="!rounded-lg !text-xs"
                />
              </label>
              <button
                type="button"
                disabled={
                  sidBusy ||
                  !isSubjectIdLengthSatisfied(
                    sidCountry,
                    sidDigits.replace(/\s/g, "").replace(/-/g, ""),
                  )
                }
                onClick={() => {
                  setSidBusy(true);
                  setErr(null);
                  const p = (async () => {
                    if (profile.id === viewerId) {
                      if (profile.hasSubjectId) {
                        return updateOwnSubjectId(sidDigits, sidCountry);
                      }
                      return setOwnProfilePin(sidDigits, sidCountry);
                    }
                    return updateManagedMemberSubjectId(profile.id, {
                      pin: sidDigits,
                      subjectIdCountry: sidCountry,
                    });
                  })();
                  void p.then((res) => {
                    setSidBusy(false);
                    if (!res.ok) {
                      setErr(res.error);
                      return;
                    }
                    setSidDigits("");
                    onReload();
                  });
                }}
                className="w-full rounded-lg bg-[#0d5c6e] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {sidBusy
                  ? "Сохранение…"
                  : profile.hasSubjectId
                    ? "Сменить идентификатор"
                    : "Сохранить идентификатор"}
              </button>
            </div>
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
          {profile.isManaged && viewerIsAdmin ? (
            <button
              type="button"
              disabled={deleting || saving}
              onClick={() => {
                if (
                  !window.confirm(
                    `Удалить карточку «${profile.displayName}» из семьи? Анализы и документы этого профиля будут удалены без восстановления.`,
                  )
                ) {
                  return;
                }
                setDeleting(true);
                setErr(null);
                void deleteManagedProfile(profile.id).then((res) => {
                  setDeleting(false);
                  if (!res.ok) {
                    setErr(res.error);
                    return;
                  }
                  onReload();
                });
              }}
              className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-60"
            >
              {deleting ? "Удаление…" : "Удалить из семьи"}
            </button>
          ) : null}
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
          {profile.medCardIsDoctor || profile.medCardIsCaregiver ? (
            <div className="mt-2 space-y-1.5 rounded-lg bg-[#f4fafb] px-2.5 py-2 text-[11px] text-[#191c1d] ring-1 ring-[#cfe8ef]">
              {profile.medCardIsDoctor ? (
                <p className="font-semibold text-[#004253]">
                  {t(lang, "profile.practitionerReadonlyDoctor")}
                </p>
              ) : null}
              {profile.medCardDoctorNote?.trim() ? (
                <p className="whitespace-pre-wrap text-[10px] leading-snug text-[#40484c]">
                  {profile.medCardDoctorNote.trim()}
                </p>
              ) : null}
              {profile.medCardIsCaregiver ? (
                <p className="font-semibold text-[#004253]">
                  {t(lang, "profile.practitionerReadonlyCaregiver")}
                </p>
              ) : null}
              {profile.medCardCaregiverNote?.trim() ? (
                <p className="whitespace-pre-wrap text-[10px] leading-snug text-[#40484c]">
                  {profile.medCardCaregiverNote.trim()}
                </p>
              ) : null}
            </div>
          ) : null}
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

// ─── Share Profile Section ────────────────────────────────────────────────────

type ShareInvite = {
  id: string;
  inviteToken: string;
  inviteCode9?: string;
  inviteExpiresAt: string | null;
  profileName: string;
};

type IssuedAccess = {
  id: string;
  inviteToken: string;
  inviteCode9: string | null;
  canWrite: boolean;
  acceptedAt: string | null;
  inviteExpiresAt: string | null;
  createdAt: string;
  sourceProfile: { id: string; displayName: string; avatarUrl: string | null };
  grantee: { id: string; displayName: string; avatarUrl: string | null } | null;
};

function IssuedSharesList({
  refreshTick,
  onRevoked,
}: {
  refreshTick: number;
  onRevoked: () => void;
}) {
  const [items, setItems] = useState<IssuedAccess[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeErr, setRevokeErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setRevokeErr(null);
    fetch("/api/profile/share", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as {
          accesses?: IssuedAccess[];
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok) {
          setErr(j.error ?? "Не удалось загрузить");
          setItems([]);
        } else {
          setItems(j.accesses ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Сеть");
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  if (loading) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">Загрузка…</p>
    );
  }
  if (err) {
    return (
      <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-700">{err}</p>
    );
  }
  if (!items || items.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        Вы ещё не создавали приглашений.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {revokeErr ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-700" role="alert">
          {revokeErr}
        </p>
      ) : null}
      {items.map((a) => {
        const accepted = Boolean(a.acceptedAt);
        const expired = !!a.inviteExpiresAt && new Date(a.inviteExpiresAt) < new Date();
        const status = accepted
          ? "accepted"
          : expired
            ? "expired"
            : "pending";
        const statusLabel =
          status === "accepted" ? "принят" : status === "expired" ? "истёк" : "ожидает";
        const statusClass =
          status === "accepted"
            ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
            : status === "expired"
              ? "bg-slate-200 text-slate-700 ring-slate-300"
              : "bg-amber-100 text-amber-900 ring-amber-200";
        return (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">
                {a.sourceProfile.displayName}
              </p>
              {accepted && a.grantee ? (
                <p className="truncate text-slate-600">
                  Принял: <b>{a.grantee.displayName}</b>
                </p>
              ) : (
                <p className="truncate text-slate-500">
                  {expired
                    ? "Срок ссылки истёк"
                    : a.inviteCode9
                      ? `Код: ${a.inviteCode9} — ждёт получателя`
                      : "Ждёт получателя — он ещё не отсканировал QR / не вошёл в Mini App"}
                </p>
              )}
              <p className="mt-0.5 text-[10px] text-slate-400">
                Создано {new Date(a.createdAt).toLocaleDateString("ru-RU")}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1",
                statusClass,
              )}
            >
              {statusLabel}
            </span>
            <button
              type="button"
              disabled={revokingId === a.id}
              title="Удалить / отозвать приглашение"
              aria-label="Удалить приглашение"
              onClick={() => {
                const msg = accepted
                  ? "Отозвать доступ для этого пользователя? Он потеряет совместный профиль."
                  : "Удалить это приглашение? Ссылка и код перестанут действовать.";
                if (!window.confirm(msg)) return;
                setRevokeErr(null);
                setRevokingId(a.id);
                void fetch(`/api/profile/share?id=${encodeURIComponent(a.id)}`, {
                  method: "DELETE",
                  credentials: "include",
                })
                  .then(async (r) => {
                    if (!r.ok) {
                      const j = (await r.json().catch(() => ({}))) as { error?: string };
                      throw new Error(j.error ?? "Ошибка");
                    }
                    onRevoked();
                  })
                  .catch((e: unknown) => {
                    setRevokeErr(e instanceof Error ? e.message : "Не удалось удалить");
                  })
                  .finally(() => setRevokingId(null));
              }}
              className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ShareProfileSection({
  lang,
  familyProfiles,
  onReload,
}: {
  lang: string;
  familyProfiles: ProfileSummary[];
  onReload: () => void;
}) {
  const [selectedProfileId, setSelectedProfileId] = useState(familyProfiles[0]?.id ?? "");
  const [invite, setInvite] = useState<ShareInvite | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [issuedRefreshTick, setIssuedRefreshTick] = useState(0);
  /** Имя бота с сервера (getMe), если в бандле нет NEXT_PUBLIC_TELEGRAM_BOT_USERNAME */
  const [resolvedBotUsername, setResolvedBotUsername] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webInvitePath = invite ? `/share-profile/${invite.inviteToken}` : "";
  const webInviteUrl = invite ? `${origin}${webInvitePath}` : null;
  const botU =
    (typeof window !== "undefined" ? telegramBotUsernameFromEnv() : "") ||
    resolvedBotUsername ||
    "";
  const joinCode = invite?.inviteCode9 ?? "";
  const webJoinUrl =
    joinCode && origin ? `${origin}/join-family?code=${joinCode}` : null;
  const telegramJoinStartUrl =
    joinCode && botU ? `https://t.me/${botU}?start=join_${joinCode}` : null;
  const telegramJoinMiniUrl =
    joinCode && botU ? `https://t.me/${botU}?startapp=join_${joinCode}` : null;
  /** Классическая ссылка по UUID-токену */
  const telegramBotStartUrl =
    invite && botU
      ? `https://t.me/${botU}?start=share_${encodeURIComponent(invite.inviteToken)}`
      : null;
  const telegramMiniAppUrl =
    invite && botU
      ? `https://t.me/${botU}?startapp=share_${encodeURIComponent(invite.inviteToken)}`
      : null;
  /** QR: при наличии 9-значного кода — join_ (код или сайт); иначе share_ / share-profile. */
  const qrValue =
    joinCode && (telegramJoinStartUrl || webJoinUrl)
      ? telegramJoinStartUrl ?? webJoinUrl
      : telegramBotStartUrl ?? webInviteUrl;

  const handleCreate = async () => {
    if (!selectedProfileId) return;
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch("/api/profile/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ profileId: selectedProfileId, expiresInDays: 30 }),
      });
      const j = (await res.json()) as ShareInvite & { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Ошибка создания ссылки");
        return;
      }
      setInvite(j);
      setIssuedRefreshTick((t) => t + 1);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!invite) return;
    await fetch(`/api/profile/share?id=${invite.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setInvite(null);
    setCopied(false);
    setIssuedRefreshTick((t) => t + 1);
  };

  const handleCopy = () => {
    const primary = webJoinUrl ?? webInviteUrl;
    if (!primary) return;
    void navigator.clipboard?.writeText(primary).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!familyProfiles.length) return null;

  return (
    <section className="rounded-2xl border border-[#e7e8e9] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-[#004253]" />
        <h2 className="text-sm font-bold text-[#191c1d]">Совместный доступ</h2>
      </div>
      <p className="mt-1 text-xs text-[#70787d]">
        Поделитесь профилем родственника с другим пользователем — он сможет видеть и добавлять документы только для этого профиля.
      </p>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Мои выданные приглашения
          </h3>
          <button
            type="button"
            onClick={() => setIssuedRefreshTick((t) => t + 1)}
            className="text-[10px] font-semibold text-teal-700 underline-offset-2 hover:underline"
          >
            Обновить
          </button>
        </div>
        <IssuedSharesList
          refreshTick={issuedRefreshTick}
          onRevoked={() => {
            setIssuedRefreshTick((t) => t + 1);
            onReload();
          }}
        />
      </div>

      {!invite ? (
        <div className="mt-3 space-y-2">
          {familyProfiles.length > 1 && (
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full rounded-xl border border-[#e7e8e9] bg-[#f8f9fa] px-3 py-2 text-sm"
            >
              {familyProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}
          {err && <p className="text-xs text-red-700">{err}</p>}
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || !selectedProfileId}
            className="w-full rounded-xl bg-[#004253] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {creating ? "Создание ссылки…" : "Создать ссылку-приглашение"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {joinCode ? (
            <p className="text-center font-mono text-xl font-bold tracking-[0.2em] text-slate-900">
              {joinCode}
            </p>
          ) : null}
          <p className="text-[11px] text-slate-600">
            {joinCode
              ? "Получатель вводит 9 цифр на сайте или сканирует QR — откроется Telegram-бот с кодом join_. После входа в Mini App (и ПИН при регистрации) профиль появится в переключателе."
              : "QR откроет Telegram-бот у получателя. Бот сохранит приглашение и пришлёт кнопку «Открыть Mini App» — после регистрации (ПИН) совместный профиль появится в переключателе. Если Telegram нет — есть веб-ссылка ниже."}
          </p>
          <div className="flex justify-center rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            {qrValue && <QRCodeSVG value={qrValue} size={160} level="M" includeMargin />}
          </div>
          {telegramJoinStartUrl ? (
            <a
              href={telegramJoinStartUrl}
              className="flex w-full items-center justify-center rounded-xl bg-sky-50 py-2.5 text-sm font-semibold text-sky-900 ring-1 ring-sky-200"
            >
              Telegram: ссылка с кодом (рекомендуется)
            </a>
          ) : telegramBotStartUrl ? (
            <a
              href={telegramBotStartUrl}
              className="flex w-full items-center justify-center rounded-xl bg-sky-50 py-2.5 text-sm font-semibold text-sky-900 ring-1 ring-sky-200"
            >
              Открыть в Telegram (рекомендуется)
            </a>
          ) : null}
          {telegramJoinMiniUrl ? (
            <a
              href={telegramJoinMiniUrl}
              className="flex w-full items-center justify-center rounded-xl bg-slate-50 py-2 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200"
            >
              Mini App: join-код (резерв)
            </a>
          ) : telegramMiniAppUrl ? (
            <a
              href={telegramMiniAppUrl}
              className="flex w-full items-center justify-center rounded-xl bg-slate-50 py-2 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200"
            >
              Открыть Mini App напрямую (резерв)
            </a>
          ) : null}
          {webJoinUrl ? (
            <p className="break-all rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-mono text-slate-700 ring-1 ring-slate-100">
              {webJoinUrl}
            </p>
          ) : null}
          {joinCode && webInviteUrl ? (
            <details className="rounded-xl bg-slate-50/80 px-3 py-2 text-[10px] text-slate-600 ring-1 ring-slate-100">
              <summary className="cursor-pointer font-semibold text-slate-700">
                Дополнительно: ссылка по UUID
              </summary>
              <p className="mt-2 break-all font-mono">{webInviteUrl}</p>
              {telegramBotStartUrl && joinCode ? (
                <a href={telegramBotStartUrl} className="mt-2 inline-block text-teal-800 underline">
                  t.me (share_…)
                </a>
              ) : null}
            </details>
          ) : (
            <p className="break-all rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-mono text-slate-700 ring-1 ring-slate-100">
              {webInviteUrl}
            </p>
          )}
          {invite.inviteExpiresAt && (
            <p className="text-[11px] text-slate-500">
              Действует до:{" "}
              {new Date(invite.inviteExpiresAt).toLocaleDateString(
                lang === "ru" ? "ru-RU" : "ky-KG",
                { day: "numeric", month: "short", year: "numeric" },
              )}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleCopy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-50 py-2 text-xs font-semibold text-teal-900 ring-1 ring-teal-100"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Скопировано!" : webJoinUrl ? "Копировать ссылку (сайт)" : "Копировать"}
            </button>
            <button
              type="button"
              onClick={() => {
                const url = telegramJoinStartUrl ?? webJoinUrl ?? webInviteUrl ?? "";
                if (!url) return;
                if (typeof navigator !== "undefined" && navigator.share) {
                  void navigator
                    .share({
                      title: "SakBol — приглашение",
                      text: "Совместный доступ к медицинскому профилю в SakBol",
                      url,
                    })
                    .catch(() => {});
                } else {
                  handleCopy();
                }
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-50 py-2 text-xs font-semibold text-sky-950 ring-1 ring-sky-200"
            >
              <Share2 className="h-3.5 w-3.5" />
              Поделиться…
            </button>
            <button
              type="button"
              onClick={() => void handleRevoke()}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 ring-1 ring-red-100 sm:shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Отозвать
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setInvite(null);
              setCopied(false);
            }}
            className="w-full rounded-xl border border-dashed border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Создать ещё одно приглашение
          </button>
          <p className="text-[10px] text-slate-500">
            Что произойдёт у получателя: камера откроет Telegram → бот сохранит приглашение → его
            кнопка «Открыть Mini App» приведёт в SakBol → после ввода ПИН (если регистрируется
            впервые) профиль появится в переключателе сверху.
          </p>
        </div>
      )}
    </section>
  );
}

export function ProfileTabSakbol({ family, loading, reload }: Props) {
  const { lang } = useLanguage();
  const { setTab } = useTabApp();
  const { activeProfileId } = useActiveProfile();
  const { authReady, isAuthenticated, state, syncViewerFromServer, signOut } = useTelegramSession();
  const [addOpen, setAddOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [doctorReportBusy, setDoctorReportBusy] = useState(false);
  /** Аккордеон семьи: открыта только одна карточка. */
  const [openFamilyCardId, setOpenFamilyCardId] = useState<string | null>(null);
  const localVitalsMigratedRef = useRef(false);

  const viewer = state.status === "authenticated" ? state.viewer : null;
  const admin = family?.profiles.find((p) => p.familyRole === "ADMIN");
  const viewerOwnProfile = viewer ? family?.profiles.find((p) => p.id === viewer.id) : null;
  const sessionProfile =
    viewer && family?.profiles ? (family.profiles.find((p) => p.id === viewer.id) ?? null) : null;

  const editTarget = useMemo(() => {
    if (!family?.profiles?.length || !viewer) return null;
    const id =
      activeProfileId && family.profiles.some((p) => p.id === activeProfileId)
        ? activeProfileId
        : viewer.id;
    return family.profiles.find((p) => p.id === id) ?? null;
  }, [family, viewer, activeProfileId]);

  const reportProfileId = viewer ? (editTarget?.id ?? viewer.id) : null;

  const canSeePatientsTab = useMemo(
    () => showPatientsTabForFamily(family ?? null, loading),
    [family, loading],
  );
  const hasIncomingSharedProfiles = (family?.sharedProfiles?.length ?? 0) > 0;

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
                ? "Откройте страницу входа: код из Telegram или email и пароль."
                : state.status === "unauthenticated" && state.reason === "no_init_data"
                  ? t(lang, "dashboard.authBodyNoTg")
                  : state.status === "unauthenticated" && state.reason === "telegram_init_data_missing"
                    ? `${t(lang, "dashboard.authTelegramRetry")} Либо войдите через сайт в браузере.`
                    : t(lang, "dashboard.authBody")}
            </p>
            {state.status === "unauthenticated" &&
            (state.reason === "web_login_required" || state.reason === "telegram_init_data_missing") ? (
              <Link
                href="/login"
                className="mt-3 inline-flex rounded-xl bg-[#5c3200] px-4 py-2 text-xs font-semibold text-[#ffead4]"
              >
                Войти на сайте
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
                    {editTarget?.medCardIsDoctor ? (
                      <span className="rounded-full bg-emerald-400/30 px-2 py-0.5 text-[10px] font-semibold text-[#e8fff4] ring-1 ring-white/25">
                        {t(lang, "profile.badgeDoctor")}
                      </span>
                    ) : null}
                    {editTarget?.medCardIsCaregiver ? (
                      <span className="rounded-full bg-amber-400/35 px-2 py-0.5 text-[10px] font-semibold text-[#fff8e8] ring-1 ring-white/25">
                        {t(lang, "profile.badgeCaregiver")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              {reportProfileId ? (
                <button
                  type="button"
                  disabled={doctorReportBusy}
                  onClick={() => {
                    if (doctorReportBusy || !reportProfileId) return;
                    setDoctorReportBusy(true);
                    void downloadDoctorReportPdf(reportProfileId)
                      .then((r) => {
                        if (!r.ok) window.alert(r.error);
                      })
                      .catch(() => {
                        window.alert("Сеть или сервер недоступны.");
                      })
                      .finally(() => setDoctorReportBusy(false));
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 py-2.5 text-xs font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm disabled:opacity-50"
                >
                  {doctorReportBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <FileDown className="h-4 w-4" aria-hidden />
                  )}
                  {t(lang, "profile.medicalReportPdf")}
                </button>
              ) : null}
            </div>

            {sessionProfile && !sessionProfile.telegramUserId ? (
              <LinkTelegramCard onReload={() => reload()} />
            ) : null}

            {sessionProfile && sessionProfile.telegramUserId ? (
              <WebLoginPhoneCard onSaved={() => reload()} />
            ) : null}

            <section className="rounded-2xl border border-[#e7e8e9] bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#004253] ring-1 ring-teal-100">
                  <Stethoscope className="h-4 w-4" strokeWidth={2} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-manrope text-sm font-bold text-[#191c1d]">
                    {t(lang, "profile.servicesForProfessionals")}
                  </h2>
                  <p className="mt-1 text-[11px] leading-snug text-[#70787d]">
                    {t(lang, "profile.servicesForProfessionalsLead")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  hapticImpact("light");
                  setTab("pharmacy");
                }}
                className="mt-3 flex w-full items-center gap-3 rounded-xl border border-[#e7e8e9] bg-gradient-to-r from-teal-50/80 to-white px-3 py-3 text-left shadow-sm transition-colors hover:border-teal-200"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#004253] shadow-sm ring-1 ring-teal-100">
                  <Pill className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#191c1d]">{t(lang, "nav.pharmacy")}</span>
                  <span className="mt-0.5 block text-[11px] text-[#70787d]">
                    {t(lang, "profile.openPharmacyTab")}
                  </span>
                </span>
              </button>
              {canSeePatientsTab || hasIncomingSharedProfiles ? (
                <div className="mt-4 border-t border-[#e7e8e9] pt-4">
                  {canSeePatientsTab ? (
                    <p className="text-[11px] leading-snug text-[#70787d]">
                      {t(lang, "profile.sharedProfilesUsePatientsTab")}
                    </p>
                  ) : (
                    <>
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#70787d]">
                        {t(lang, "profile.sharedProfilesSectionTitle")}
                      </h3>
                      <p className="mt-1 text-[11px] leading-snug text-[#70787d]">
                        {t(lang, "profile.sharedProfilesSectionHint")}
                      </p>
                      <div className="mt-3 rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
                        <DoctorPatientsSection family={family ?? null} loading={loading} variant="embedded" />
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </section>

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

            <ShareProfileSection
              lang={lang}
              familyProfiles={(family?.profiles ?? []).filter((p) => !p.isSharedGuest)}
              onReload={reload}
            />

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

            <button
              type="button"
              disabled={signingOut}
              onClick={async () => {
                if (signingOut) return;
                const ok = typeof window === "undefined" ? true : window.confirm(
                  "Выйти из аккаунта? Потребуется войти заново — по email или коду из Telegram.",
                );
                if (!ok) return;
                setSigningOut(true);
                try {
                  await signOut();
                } finally {
                  setSigningOut(false);
                }
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <MaterialIcon name="logout" className="text-red-700" />
              {signingOut ? "Выход…" : "Выйти из аккаунта"}
            </button>

            <p className="text-center text-[10px] text-[#70787d]">
              Версия 0.1 · Кыргызстан 🇰🇬
            </p>
          </>
        ) : null}
      </div>

      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={reload}
        familyProfilesForInvite={(family?.profiles ?? []).filter((p) => !p.isSharedGuest)}
      />

      <BottomSheet open={premiumOpen} title="SakBol Premium" onClose={() => setPremiumOpen(false)}>
        <p className="text-sm text-[#40484c]">
          Получите расширенный доступ: безлимит расшифровок анализов, семейные профили и приоритет
          поддержки. Пробный период и отмена — по условиям в разделе «Конфиденциальность».
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-[#e7e8e9]">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-[#f8f9fa] text-[#191c1d]">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Тариф</th>
                <th className="px-2 py-1.5 font-semibold">Цена</th>
                <th className="px-2 py-1.5 font-semibold">Проба</th>
              </tr>
            </thead>
            <tbody className="text-[#40484c]">
              <tr className="border-t border-[#e7e8e9]">
                <td className="px-2 py-1.5">Месяц</td>
                <td className="px-2 py-1.5">699 ₽/мес</td>
                <td className="px-2 py-1.5">7 дн.</td>
              </tr>
              <tr className="border-t border-[#e7e8e9]">
                <td className="px-2 py-1.5">Год</td>
                <td className="px-2 py-1.5">4 490 ₽/год</td>
                <td className="px-2 py-1.5">7 дн.</td>
              </tr>
              <tr className="border-t border-[#e7e8e9]">
                <td className="px-2 py-1.5">Навсегда</td>
                <td className="px-2 py-1.5">14 990 ₽</td>
                <td className="px-2 py-1.5">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[#70787d]">
          Оплата подключается в одном из следующих релизов. Вопросы:{" "}
          <a className="font-medium text-[#004253] underline" href="mailto:support@sakbol.app">
            support@sakbol.app
          </a>
          .
        </p>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-sakbol-cta py-3 font-semibold text-white shadow-sm shadow-coral/25 transition-[filter] hover:brightness-[1.04]"
        >
          Сообщить о готовности оплатить
        </button>
      </BottomSheet>

      <BottomSheet open={notifyOpen} title="Уведомления" onClose={() => setNotifyOpen(false)}>
        <ProfileNotificationsContent />
      </BottomSheet>

      <BottomSheet open={privacyOpen} title="Конфиденциальность" onClose={() => setPrivacyOpen(false)}>
        <ProfilePrivacyContent />
      </BottomSheet>

      <BottomSheet open={supportOpen} title="Поддержка" onClose={() => setSupportOpen(false)}>
        <ProfileSupportForm
          userId={viewer?.id ?? null}
          clinicalLabel={viewer?.id ? formatClinicalAnonymId(viewer.id) : null}
        />
      </BottomSheet>
    </div>
  );
}
