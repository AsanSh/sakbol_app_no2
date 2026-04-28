"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, KeyRound, Plus, Share2 } from "lucide-react";
import type { ProfileSummary } from "@/types/family";
import { useActiveProfile } from "@/context/active-profile-context";
import { useLanguage } from "@/context/language-context";
import { useDeviceType } from "@/hooks/use-device-type";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/telegram-haptics";
import { ProfileAvatar } from "@/components/ui/avatar";
import { profileKinshipLabel } from "@/lib/profile-kinship";

type FamilySwitcherProps = {
  profiles: ProfileSummary[];
  className?: string;
  canAddMember?: boolean;
  onAddMember?: () => void;
  /** Страница ввода 9-значного кода приглашения (например /join-family). */
  joinFamilyHref?: string;
  /** Компактная строка для шапки: без заголовка секции и без псевдо-ID под списком. */
  variant?: "default" | "header";
};

const STACK_AVATAR = 36;

export function FamilySwitcher({
  profiles,
  className,
  canAddMember,
  onAddMember,
  joinFamilyHref,
  variant = "default",
}: FamilySwitcherProps) {
  const { lang } = useLanguage();
  const device = useDeviceType();
  const { activeProfileId, setActiveProfileId, switchProfile } = useActiveProfile();
  const [expanded, setExpanded] = useState(false);

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
  const overlapStack = isHeader && device !== "desktop-web";
  const avatarSize = isHeader ? 40 : 56;
  const addBtnClass = isHeader ? "h-10 w-10" : "h-14 w-14";
  const plusClass = isHeader ? "h-5 w-5" : "h-6 w-6";
  const pulseTransition = {
    duration: 1.6,
    repeat: Infinity,
    repeatType: "loop" as const,
    ease: "easeOut" as const,
  };

  function pickProfile(id: string) {
    hapticImpact("medium");
    switchProfile(id);
    if (overlapStack) setExpanded(false);
  }

  if (overlapStack && !expanded) {
    return (
      <div className={cn("flex w-full min-w-0 items-center justify-end gap-1", className)}>
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            setExpanded(true);
          }}
          className="flex max-w-full items-center gap-0.5 rounded-full border border-health-border/70 bg-health-surface/95 py-1 pl-1 pr-1.5 shadow-sm outline-none ring-health-primary focus-visible:ring-2"
          aria-expanded={false}
          aria-label={t(lang, "family.switcherTitle")}
        >
          <span className="flex items-center pl-0.5">
            {profiles.map((p, i) => {
              const active = p.id === activeProfileId;
              return (
                <span
                  key={p.id}
                  className={cn("relative rounded-full ring-2 ring-health-bg", i > 0 && "-ml-2.5")}
                  style={{ zIndex: active ? 50 : 10 + i }}
                >
                  {active ? (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute -inset-1 rounded-full border border-health-primary/40"
                      animate={{ scale: [1, 1.16], opacity: [0.5, 0] }}
                      transition={pulseTransition}
                    />
                  ) : null}
                  <ProfileAvatar
                    src={p.avatarUrl}
                    name={p.displayName}
                    size={STACK_AVATAR}
                    className={cn(
                      "ring-2 ring-offset-0 ring-offset-health-bg",
                      active ? "ring-health-primary shadow-md" : "ring-white/75 opacity-55",
                    )}
                  />
                  {p.isSharedGuest ? (
                    <span
                      aria-hidden
                      title="Совместный профиль"
                      className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow ring-2 ring-health-bg"
                    >
                      <Share2 className="h-2.5 w-2.5" strokeWidth={2.5} />
                    </span>
                  ) : null}
                </span>
              );
            })}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-health-text-secondary" aria-hidden />
        </button>
        <span className="flex shrink-0 items-center gap-0.5">
          {joinFamilyHref ? (
            <Link
              href={joinFamilyHref}
              onClick={(e) => e.stopPropagation()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-health-border/80 bg-health-surface text-health-primary shadow-sm outline-none ring-health-primary focus-visible:ring-2"
              title={lang === "ru" ? "Ввести код приглашения" : "Чакыруу кодун киргизүү"}
              aria-label={lang === "ru" ? "Ввести код приглашения" : "Чакыруу кодун киргизүү"}
            >
              <KeyRound className="h-4 w-4" strokeWidth={2} />
            </Link>
          ) : null}
          {canAddMember && onAddMember ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                hapticImpact("medium");
                onAddMember();
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-health-border bg-health-surface text-health-primary shadow-sm outline-none ring-health-primary focus-visible:ring-2"
              aria-label={t(lang, "profile.addMember")}
            >
              <Plus className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : null}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(isHeader ? "w-max max-w-full" : "w-full", className)}>
      {!isHeader ? (
        <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
          {t(lang, "family.switcherTitle")}
        </p>
      ) : overlapStack && expanded ? (
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            setExpanded(false);
          }}
          className="mb-1 flex w-full items-center justify-end gap-1 text-[10px] font-semibold text-health-primary"
        >
          <ChevronDown className="h-4 w-4 rotate-180" aria-hidden />
          {t(lang, "family.collapseSwitcher")}
        </button>
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
                onClick={() => pickProfile(p.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-0.5 pt-0.5 outline-none ring-health-primary focus-visible:ring-2",
                  active ? "opacity-100" : "opacity-55 hover:opacity-75",
                )}
                aria-pressed={active}
                aria-label={`${t(lang, "profile.title")}: ${p.displayName}`}
              >
                <span className="relative">
                  {isHeader && active ? (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute -inset-1 rounded-full border border-health-primary/40"
                      animate={{ scale: [1, 1.18], opacity: [0.55, 0] }}
                      transition={pulseTransition}
                    />
                  ) : null}
                  <ProfileAvatar
                    src={p.avatarUrl}
                    name={p.displayName}
                    size={avatarSize}
                    className={cn(
                      "ring-2 ring-offset-2 ring-offset-health-bg transition-shadow",
                      isHeader && "ring-1 ring-offset-1",
                      active ? "ring-health-primary shadow-md" : "ring-transparent opacity-70",
                    )}
                  />
                  {p.isSharedGuest ? (
                    <span
                      aria-hidden
                      title="Совместный профиль"
                      className={cn(
                        "absolute flex items-center justify-center rounded-full bg-amber-500 text-white shadow ring-2 ring-health-bg",
                        isHeader ? "-bottom-0.5 -right-0.5 h-4 w-4" : "-bottom-1 -right-1 h-5 w-5",
                      )}
                    >
                      <Share2 className={isHeader ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={2.5} />
                    </span>
                  ) : null}
                </span>
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
                    {profileKinshipLabel(p, lang)}
                  </span>
                </span>
              </motion.button>
            </li>
          );
        })}
        {joinFamilyHref ? (
          <li className="shrink-0">
            <Link
              href={joinFamilyHref}
              className="flex flex-col items-center gap-0.5 rounded-xl px-0.5 pt-0.5 outline-none ring-health-primary focus-visible:ring-2"
              title={lang === "ru" ? "Ввести код приглашения" : "Чакыруу кодун киргизүү"}
              aria-label={lang === "ru" ? "Ввести код приглашения" : "Чакыруу кодун киргизүү"}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full border border-health-border bg-health-surface text-health-primary",
                  addBtnClass,
                )}
              >
                <KeyRound className={isHeader ? "h-5 w-5" : "h-6 w-6"} strokeWidth={2} />
              </span>
              <span
                className={cn(
                  "max-w-[4rem] text-center font-medium text-health-text-secondary",
                  isHeader ? "text-[10px]" : "text-[11px]",
                )}
              >
                {lang === "ru" ? "Код" : "Код"}
              </span>
            </Link>
          </li>
        ) : null}
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
