"use client";

import {
  LayoutDashboard,
  Stethoscope,
  HeartPulse,
  BotMessageSquare,
  UserCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/telegram-haptics";
import type { MainTab } from "@/context/tab-app-context";
import { useTabApp } from "@/context/tab-app-context";

type NavItem = { id: MainTab; label: string; Icon: LucideIcon };

const ITEMS: NavItem[] = [
  { id: "home", label: "Главная", Icon: LayoutDashboard },
  { id: "analyses", label: "Анализы", Icon: Stethoscope },
  { id: "risks", label: "Риски", Icon: HeartPulse },
  { id: "ai", label: "ИИ", Icon: BotMessageSquare },
  { id: "profile", label: "Профиль", Icon: UserCircle },
];

/** Узкая бирюзовая колонка в духе медицинского / финтех-дашборда. */
export function SakbolDesktopNav() {
  const { tab, setTab } = useTabApp();

  return (
    <aside
      className="sticky top-0 flex h-dvh w-[4.75rem] shrink-0 flex-col items-center bg-gradient-to-b from-teal-700 via-teal-800 to-teal-900 py-5 shadow-[4px_0_24px_-4px_rgba(15,118,110,0.45)]"
      aria-label="Меню"
    >
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white shadow-inner ring-1 ring-white/20">
        <HeartPulse size={24} strokeWidth={2} aria-hidden />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                hapticImpact("medium");
                setTab(id);
              }}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200",
                active
                  ? "bg-white text-teal-800 shadow-lg shadow-teal-950/30"
                  : "text-white/90 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
            </button>
          );
        })}
      </nav>

      <p className="mt-auto px-1 text-center font-manrope text-[9px] font-bold uppercase tracking-widest text-teal-200/80">
        KG
      </p>
    </aside>
  );
}
