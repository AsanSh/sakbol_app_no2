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
  { id: "home",     label: "Главная",  Icon: LayoutDashboard  },
  { id: "analyses", label: "Анализы",  Icon: Stethoscope       },
  { id: "risks",    label: "Риски",    Icon: HeartPulse         },
  { id: "ai",       label: "ИИ",       Icon: BotMessageSquare  },
  { id: "profile",  label: "Профиль",  Icon: UserCircle        },
];

export function BottomTabBar() {
  const { tab, setTab } = useTabApp();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-[#e7e8e9]/90",
        "bg-white/80 shadow-[0_-8px_32px_rgba(0,66,83,0.08)] backdrop-blur-xl",
        "rounded-t-[1.5rem]",
        "[padding-bottom:max(0.5rem,env(safe-area-inset-bottom,0px))]",
      )}
      aria-label="Основная навигация"
    >
      <ul className="mx-auto flex max-w-2xl list-none items-stretch justify-between gap-0 px-2 pt-2">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  hapticImpact("medium");
                  setTab(id);
                }}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-cyan-50/80 text-[#004253]"
                    : "text-slate-400 hover:bg-slate-50/80",
                )}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2 : 1.5}
                  aria-hidden
                />
                <span className="truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
