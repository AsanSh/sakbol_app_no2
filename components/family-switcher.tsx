"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { ProfileSummary } from "@/types/family";
import { useActiveProfile } from "@/context/active-profile-context";
import { useLanguage } from "@/context/language-context";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/telegram-haptics";
import { ProfileAvatar } from "@/components/ui/avatar";

type FamilySwitcherProps = {
  profiles: ProfileSummary[];
  className?: string;
  canAddMember?: boolean;
  onAddMember?: () => void;
};

export function FamilySwitcher({
  profiles,
  className,
  canAddMember,
  onAddMember,
}: FamilySwitcherProps) {
  const { lang } = useLanguage();
  const { activeProfileId, setActiveProfileId, switchProfile } = useActiveProfile();

  useEffect(() => {
    if (profiles.length === 0) return;
    const ids = new Set(profiles.map((p) => p.id));
    if (!activeProfileId || !ids.has(activeProfileId)) {
      setActiveProfileId(profiles[0].id);
    }
  }, [profiles, activeProfileId, setActiveProfileId]);

  if (profiles.length === 0) return null;

  const activeClinical =
    activeProfileId != null ? formatClinicalAnonymId(activeProfileId) : null;

  return (
    <div className={cn("w-full", className)}>
      <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
        {t(lang, "family.switcherTitle")}
      </p>
      <ul className="flex gap-3 overflow-x-auto overflow-y-visible px-1 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {profiles.map((p) => {
          const active = p.id === activeProfileId;
          return (
            <li key={p.id} className="shrink-0">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  hapticImpact("medium");
                  switchProfile(p.id);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-1 pt-1 outline-none ring-health-primary focus-visible:ring-2",
                  active ? "opacity-100" : "opacity-85 hover:opacity-100",
                )}
                aria-pressed={active}
                aria-label={`${t(lang, "profile.title")}: ${p.displayName}`}
              >
                <ProfileAvatar
                  src={p.avatarUrl}
                  name={p.displayName}
                  size={56}
                  className={cn(
                    "ring-2 ring-offset-2 ring-offset-health-bg transition-shadow",
                    active ? "ring-health-primary shadow-md" : "ring-transparent",
                  )}
                />
                <span
                  className={cn(
                    "max-w-[4.5rem] truncate text-center text-[11px] font-medium leading-tight",
                    active ? "text-health-text" : "text-health-text-secondary",
                  )}
                >
                  {p.displayName}
                </span>
              </motion.button>
            </li>
          );
        })}
        {canAddMember && onAddMember ? (
          <li className="shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onAddMember}
              className="flex flex-col items-center gap-1 rounded-2xl px-1 pt-1 outline-none ring-health-primary focus-visible:ring-2"
              aria-label={t(lang, "profile.addMember")}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-health-border bg-health-surface text-health-primary">
                <Plus className="h-6 w-6" strokeWidth={2} />
              </span>
              <span className="max-w-[4.5rem] text-center text-[11px] font-medium text-health-text-secondary">
                {t(lang, "family.addMemberShort")}
              </span>
            </motion.button>
          </li>
        ) : null}
      </ul>
      {activeClinical ? (
        <p className="mt-2 text-center font-mono text-[10px] leading-snug text-health-text-secondary">
          <span className="font-sans text-health-text-secondary/90">{t(lang, "profile.clinicalIdShort")}: </span>
          {activeClinical}
        </p>
      ) : null}
    </div>
  );
}
