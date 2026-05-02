"use client";

import { useEffect, useState } from "react";
import { Loader2, Stethoscope } from "lucide-react";
import { updateOwnProfilePractitionerFlags } from "@/app/actions/profile";
import { t, type Lang } from "@/lib/i18n";
import type { ProfileSummary } from "@/types/family";
import { cn } from "@/lib/utils";

type Props = {
  lang: Lang;
  profile: ProfileSummary;
  onSaved: () => void;
  syncViewerFromServer: () => Promise<void>;
};

export function ProfilePractitionerForm({
  lang,
  profile,
  onSaved,
  syncViewerFromServer,
}: Props) {
  const [isDoctor, setIsDoctor] = useState(Boolean(profile.medCardIsDoctor));
  const [isCaregiver, setIsCaregiver] = useState(Boolean(profile.medCardIsCaregiver));
  const [doctorNote, setDoctorNote] = useState(profile.medCardDoctorNote?.trim() ?? "");
  const [caregiverNote, setCaregiverNote] = useState(profile.medCardCaregiverNote?.trim() ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setIsDoctor(Boolean(profile.medCardIsDoctor));
    setIsCaregiver(Boolean(profile.medCardIsCaregiver));
    setDoctorNote(profile.medCardDoctorNote?.trim() ?? "");
    setCaregiverNote(profile.medCardCaregiverNote?.trim() ?? "");
    setErr(null);
  }, [
    profile.id,
    profile.medCardIsDoctor,
    profile.medCardIsCaregiver,
    profile.medCardDoctorNote,
    profile.medCardCaregiverNote,
  ]);

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const prRes = await updateOwnProfilePractitionerFlags({
        isDoctor,
        isCaregiver,
        doctorNote: doctorNote.trim() || null,
        caregiverNote: caregiverNote.trim() || null,
      });
      if (!prRes.ok) {
        setErr(prRes.error);
        return;
      }
      await syncViewerFromServer();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#cfe8ef] bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/50 p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#004253] text-white"
          aria-hidden
        >
          <Stethoscope className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-[#004253]">{t(lang, "profile.practitionerTitle")}</h3>
          <p className="mt-1 text-[11px] leading-snug text-[#3d5258]">{t(lang, "profile.b2bPractitionerLead")}</p>
        </div>
      </div>
      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/90 p-3 text-sm font-medium text-[#191c1d] ring-1 ring-[#d4eaef]">
          <input
            type="checkbox"
            checked={isDoctor}
            onChange={(e) => setIsDoctor(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#004253]"
          />
          <span className="leading-snug">{t(lang, "profile.practitionerDoctor")}</span>
        </label>
        {isDoctor ? (
          <textarea
            value={doctorNote}
            onChange={(e) => setDoctorNote(e.target.value.slice(0, 2000))}
            placeholder={t(lang, "profile.practitionerDoctorHint")}
            rows={3}
            className="w-full resize-y rounded-xl border border-[#e0eef2] bg-white px-3 py-2 text-sm text-[#191c1d]"
          />
        ) : null}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/90 p-3 text-sm font-medium text-[#191c1d] ring-1 ring-[#d4eaef]">
          <input
            type="checkbox"
            checked={isCaregiver}
            onChange={(e) => setIsCaregiver(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#004253]"
          />
          <span className="leading-snug">{t(lang, "profile.practitionerCaregiver")}</span>
        </label>
        {isCaregiver ? (
          <textarea
            value={caregiverNote}
            onChange={(e) => setCaregiverNote(e.target.value.slice(0, 2000))}
            placeholder={t(lang, "profile.practitionerCaregiverHint")}
            rows={3}
            className="w-full resize-y rounded-xl border border-[#e0eef2] bg-white px-3 py-2 text-sm text-[#191c1d]"
          />
        ) : null}
      </div>
      {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#004253] py-3 text-sm font-semibold text-white",
          "disabled:opacity-50",
        )}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {saving ? "…" : t(lang, "profile.savePractitioner")}
      </button>
    </div>
  );
}
