"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Loader2, UsersRound } from "lucide-react";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { ProfileAvatar } from "@/components/ui/avatar";
import { useActiveProfile } from "@/context/active-profile-context";
import { useLanguage } from "@/context/language-context";
import { useTabApp } from "@/context/tab-app-context";
import { useFamilyDefault } from "@/hooks/use-family-default";
import { downloadDoctorReportPdf } from "@/lib/client/download-doctor-report-pdf";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import { t } from "@/lib/i18n";
import { hapticImpact } from "@/lib/telegram-haptics";
import { cn } from "@/lib/utils";
import type { ProfileSummary } from "@/types/family";

function PatientCard({
  profile,
  onOpenAnalyses,
  onOpenOverview,
  onOpenProfile,
}: {
  profile: ProfileSummary;
  onOpenAnalyses: () => void;
  onOpenOverview: () => void;
  onOpenProfile: () => void;
}) {
  const { lang } = useLanguage();
  const [pdfBusy, setPdfBusy] = useState(false);
  const accepted = profile.sharedAcceptedAt
    ? new Date(profile.sharedAcceptedAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "ky-KG")
    : null;
  const canWrite = profile.sharedCanWrite !== false;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-health-border bg-health-surface p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <ProfileAvatar src={profile.avatarUrl} name={profile.displayName} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-manrope text-base font-bold text-health-text">{profile.displayName}</p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
            ID: {formatClinicalAnonymId(profile.id)}
          </p>
          {accepted ? (
            <p className="mt-1 text-[11px] text-health-text-secondary">
              {t(lang, "doctorPatients.accessSince")}: {accepted}
            </p>
          ) : null}
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
              canWrite ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
            )}
          >
            {canWrite ? t(lang, "doctorPatients.canEditDocs") : t(lang, "doctorPatients.viewOnly")}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-health-primary px-3 py-2 text-[11px] font-semibold text-white"
          onClick={() => {
            hapticImpact("medium");
            onOpenAnalyses();
          }}
        >
          {t(lang, "doctorPatients.openAnalyses")}
        </button>
        <button
          type="button"
          className="rounded-xl bg-teal-50 px-3 py-2 text-[11px] font-semibold text-health-primary ring-1 ring-teal-100"
          onClick={() => {
            hapticImpact("light");
            onOpenOverview();
          }}
        >
          {t(lang, "doctorPatients.openOverview")}
        </button>
        <button
          type="button"
          className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-semibold text-health-text"
          onClick={() => {
            hapticImpact("light");
            onOpenProfile();
          }}
        >
          {t(lang, "doctorPatients.openProfile")}
        </button>
        <button
          type="button"
          disabled={pdfBusy}
          className="inline-flex items-center gap-1 rounded-xl border border-health-border bg-white px-3 py-2 text-[11px] font-semibold text-health-text disabled:opacity-50"
          onClick={() => {
            hapticImpact("light");
            setPdfBusy(true);
            void downloadDoctorReportPdf(profile.id)
              .then((r) => {
                if (!r.ok) window.alert(r.error);
              })
              .finally(() => setPdfBusy(false));
          }}
        >
          {pdfBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <FileText className="h-3.5 w-3.5" aria-hidden />
          )}
          {pdfBusy ? t(lang, "doctorPatients.pdfBusy") : t(lang, "doctorPatients.downloadPdf")}
        </button>
      </div>
    </motion.li>
  );
}

export function MyPatientsTab() {
  const { lang } = useLanguage();
  const { family, loading } = useFamilyDefault();
  const { switchProfile } = useActiveProfile();
  const { setTab, setInsightsView } = useTabApp();

  const shared = family?.sharedProfiles ?? [];

  if (loading && !family) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-2 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-health-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div className="w-full">
      <SakbolTopBar title={t(lang, "doctorPatients.title")} />
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-8 pt-2">
        <p className="text-caption leading-relaxed text-health-text-secondary">{t(lang, "doctorPatients.subtitle")}</p>
        {shared.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-health-border bg-slate-50/90 px-4 py-8 text-center">
            <UsersRound className="mx-auto h-10 w-10 text-slate-400" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 font-semibold text-health-text">{t(lang, "doctorPatients.emptyTitle")}</p>
            <p className="mx-auto mt-2 max-w-md text-caption leading-relaxed text-health-text-secondary">
              {t(lang, "doctorPatients.emptyBody")}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {shared.map((p) => (
              <PatientCard
                key={p.id}
                profile={p}
                onOpenAnalyses={() => {
                  switchProfile(p.id);
                  setTab("analyses");
                }}
                onOpenOverview={() => {
                  switchProfile(p.id);
                  setInsightsView("trends");
                }}
                onOpenProfile={() => {
                  switchProfile(p.id);
                  setTab("profile");
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
