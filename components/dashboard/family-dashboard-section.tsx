"use client";

import { FamilyRole } from "@prisma/client";
import { UserPlus } from "lucide-react";
import type { ProfileSummary } from "@/types/family";
import { DsCard } from "@/components/ui/ds-card";
import { ProfileAvatar } from "@/components/ui/avatar";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import { profileKinshipLabel } from "@/lib/profile-kinship";
import { hapticImpact } from "@/lib/telegram-haptics";
import { cn } from "@/lib/utils";

type Props = {
  profiles: ProfileSummary[];
  activeProfileId: string | null;
  onSelectProfile: (id: string) => void;
  onManageFamily: () => void;
  onAddMember: () => void;
  className?: string;
};

function roleLabel(lang: "ru" | "kg", profile: ProfileSummary): string {
  if (profile.familyRole === FamilyRole.ADMIN) {
    return t(lang, "dashboard.family.roleAdministrator");
  }
  return profileKinshipLabel(profile, lang);
}

export function FamilyDashboardSection({
  profiles,
  activeProfileId,
  onSelectProfile,
  onManageFamily,
  onAddMember,
  className,
}: Props) {
  const { lang } = useLanguage();

  return (
    <DsCard variant="muted" className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-manrope text-h3 font-semibold text-health-text">
            {t(lang, "dashboard.family.title")}
          </h2>
          <p className="mt-1 text-body text-health-text-secondary">
            {t(lang, "dashboard.family.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={onManageFamily}
          className="shrink-0 text-caption font-semibold text-health-primary hover:underline"
        >
          {t(lang, "dashboard.family.manage")}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {profiles.map((p) => {
          const active = p.id === activeProfileId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                hapticImpact("medium");
                onSelectProfile(p.id);
              }}
              className={cn(
                "flex min-h-[44px] w-full items-center gap-3 rounded-2xl bg-health-surface p-3 text-left shadow-sm ring-1 transition-all duration-300",
                active ? "ring-2 ring-health-primary/90 shadow-md" : "ring-health-border/60 hover:shadow-md",
              )}
            >
              <ProfileAvatar src={p.avatarUrl} name={p.displayName} size={48} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-health-text">{p.displayName}</p>
                <p className="text-caption text-health-text-secondary">{roleLabel(lang, p)}</p>
                {active ? (
                  <span className="mt-1 inline-block rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-health-primary ring-1 ring-teal-100">
                    {t(lang, "dashboard.family.active")}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onAddMember}
          className="flex min-h-[44px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-health-border/90 bg-slate-50/80 p-4 text-center transition-all hover:bg-health-surface"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-health-surface shadow-sm ring-1 ring-health-border/70">
            <UserPlus size={22} strokeWidth={1.5} className="text-health-text-secondary" />
          </div>
          <span className="text-caption font-semibold text-health-text-secondary">
            + {t(lang, "dashboard.family.addMemberCard")}
          </span>
        </button>
      </div>
    </DsCard>
  );
}
