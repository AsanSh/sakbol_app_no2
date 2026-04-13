"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { ProfileSummary } from "@/types/family";
import { useActiveProfile } from "@/context/active-profile-context";
import { cn } from "@/lib/utils";

function initials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  const s = (a + b).toUpperCase();
  return s || "?";
}

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
  const { activeProfileId, setActiveProfileId, switchProfile } = useActiveProfile();

  useEffect(() => {
    if (profiles.length === 0) return;
    const ids = new Set(profiles.map((p) => p.id));
    if (!activeProfileId || !ids.has(activeProfileId)) {
      setActiveProfileId(profiles[0].id);
    }
  }, [profiles, activeProfileId, setActiveProfileId]);

  if (profiles.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-800/70">
        {"\u04af\u0439-\u0431\u04af\u043b\u04e9 \u043c\u04af\u0447\u04e9\u043b\u04e9\u0440\u04af"}
      </p>
      <ul className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {profiles.map((p) => {
          const active = p.id === activeProfileId;
          return (
            <li key={p.id} className="shrink-0">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => switchProfile(p.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-1 pt-1 outline-none ring-emerald-600 focus-visible:ring-2",
                  active ? "opacity-100" : "opacity-80 hover:opacity-100",
                )}
                aria-pressed={active}
                aria-label={`Профиль: ${p.displayName}`}
              >
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    active
                      ? "border-amber-500 bg-emerald-900 text-mint shadow-md"
                      : "border-emerald-700/40 bg-white text-emerald-900",
                  )}
                >
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.avatarUrl}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    initials(p.displayName)
                  )}
                </span>
                <span
                  className={cn(
                    "max-w-[4.5rem] truncate text-center text-[11px] font-medium leading-tight",
                    active ? "text-emerald-950" : "text-emerald-900/75",
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
              className="flex flex-col items-center gap-1 rounded-2xl px-1 pt-1 outline-none ring-emerald-600 focus-visible:ring-2"
              aria-label="Мүчө кошуу"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-emerald-700/50 bg-white text-emerald-900">
                <Plus className="h-6 w-6" strokeWidth={2} />
              </span>
              <span className="max-w-[4.5rem] text-center text-[11px] font-medium text-emerald-900/75">
                Кошуу
              </span>
            </motion.button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
