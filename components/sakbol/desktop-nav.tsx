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

export function SakbolDesktopNav() {
  const { tab, setTab } = useTabApp();

  return (
    <aside
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-[#e7e8e9] bg-white/90 backdrop-blur-md lg:flex"
      aria-label="Меню"
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#004253] to-[#005b71] text-white">
          <HeartPulse size={20} strokeWidth={2} aria-hidden />
        </div>
        <div>
          <p className="font-manrope text-base font-extrabold text-[#004253]">Sakbol</p>
          <p className="text-[10px] text-[#70787d]">Кыргызстан</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                hapticImpact("medium");
                setTab(id);
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                active
                  ? "bg-cyan-50/90 text-[#004253]"
                  : "text-slate-500 hover:bg-slate-50",
              )}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.5}
                aria-hidden
              />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
