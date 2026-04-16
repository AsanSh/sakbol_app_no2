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
import { profileKinshipLabelRu } from "@/lib/profile-kinship";

type FamilySwitcherProps = {
  profiles: ProfileSummary[];
  className?: string;
  canAddMember?: boolean;
  onAddMember?: () => void;
  /** Компактная строка для шапки: без заголовка секции и без псевдо-ID под списком. */
  variant?: "default" | "header";
};

export function FamilySwitcher({
  profiles,
  className,
  canAddMember,
  onAddMember,
  variant = "default",
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
  const isHeader = variant === "header";
  const avatarSize = isHeader ? 40 : 56;
  const addBtnClass = isHeader ? "h-10 w-10" : "h-14 w-14";
  const plusClass = isHeader ? "h-5 w-5" : "h-6 w-6";

  return (
    <div className={cn(isHeader ? "w-max max-w-full" : "w-full", className)}>
      {!isHeader ? (
        <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
          {t(lang, "family.switcherTitle")}
        </p>
      ) : null}
      <ul
        className={cn(
          "flex overflow-x-auto overflow-y-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          isHeader ? "items-center gap-2 py-0.5 pr-1" : "gap-3 px-1 py-3",
        )}
      >
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
                  "flex flex-col items-center gap-0.5 rounded-xl px-0.5 pt-0.5 outline-none ring-health-primary focus-visible:ring-2",
                  active ? "opacity-100" : "opacity-85 hover:opacity-100",
                )}
                aria-pressed={active}
                aria-label={`${t(lang, "profile.title")}: ${p.displayName}`}
              >
                <ProfileAvatar
                  src={p.avatarUrl}
                  name={p.displayName}
                  size={avatarSize}
                  className={cn(
                    "ring-2 ring-offset-2 ring-offset-health-bg transition-shadow",
                    isHeader && "ring-1 ring-offset-1",
                    active ? "ring-health-primary shadow-md" : "ring-transparent",
                  )}
                />
                <span className="flex max-w-[4.5rem] flex-col items-center gap-0 leading-tight">
                  <span
                    className={cn(
                      "w-full truncate text-center font-medium",
                      isHeader ? "text-[10px]" : "text-[11px]",
                      active ? "text-health-text" : "text-health-text-secondary",
                    )}
                  >
                    {p.displayName}
                  </span>
                  <span
                    className={cn(
                      "w-full truncate text-center",
                      isHeader ? "text-[9px]" : "text-[10px]",
                      active ? "text-health-text-secondary" : "text-health-text-secondary/85",
                    )}
                  >
                    {profileKinshipLabelRu(p)}
                  </span>
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
              className="flex flex-col items-center gap-0.5 rounded-xl px-0.5 pt-0.5 outline-none ring-health-primary focus-visible:ring-2"
              aria-label={t(lang, "profile.addMember")}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full border-2 border-dashed border-health-border bg-health-surface text-health-primary",
                  addBtnClass,
                )}
              >
                <Plus className={plusClass} strokeWidth={2} />
              </span>
              <span
                className={cn(
                  "max-w-[4rem] text-center font-medium text-health-text-secondary",
                  isHeader ? "text-[10px]" : "text-[11px]",
                )}
              >
                {t(lang, "family.addMemberShort")}
              </span>
            </motion.button>
          </li>
        ) : null}
      </ul>
      {!isHeader && activeClinical ? (
        <p className="mt-2 text-center font-mono text-[10px] leading-snug text-health-text-secondary">
          <span className="font-sans text-health-text-secondary/90">{t(lang, "profile.clinicalIdShort")}: </span>
          {activeClinical}
        </p>
      ) : null}
    </div>
  );
}
