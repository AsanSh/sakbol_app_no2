"use client";

import {
  LayoutDashboard,
  Stethoscope,
  TrendingUp,
  HeartPulse,
  BotMessageSquare,
  UserCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/telegram-haptics";
import type { MainTab } from "@/context/tab-app-context";
import { useTabApp } from "@/context/tab-app-context";

type Dock = "fixed" | "embedded";

type NavItem = { id: MainTab; label: string; Icon: LucideIcon };

const ITEMS: NavItem[] = [
  { id: "home", label: "Главная", Icon: LayoutDashboard },
  { id: "analyses", label: "Анализы", Icon: Stethoscope },
  { id: "trends", label: "Динамика", Icon: TrendingUp },
  { id: "risks", label: "Риски", Icon: HeartPulse },
  { id: "ai", label: "ИИ", Icon: BotMessageSquare },
  { id: "profile", label: "Профиль", Icon: UserCircle },
];

type TabBarProps = {
  /** fixed — на весь экран (TWA / моб. браузер); embedded — внутри узкой колонки на ПК */
  dock?: Dock;
};

export function BottomTabBar({ dock = "fixed" }: TabBarProps) {
  const { tab, setTab } = useTabApp();

  return (
    <nav
      className={cn(
        "z-50 border-t border-health-border/80",
        "bg-gradient-to-t from-health-surface/98 via-teal-50/40 to-health-surface/95 shadow-[0_-12px_40px_-8px_rgba(15,118,110,0.12)] backdrop-blur-xl",
        "rounded-t-[1.5rem]",
        "[padding-bottom:max(0.5rem,env(safe-area-inset-bottom,0px))]",
        dock === "fixed"
          ? "fixed bottom-0 left-0 right-0"
          : "relative mt-auto w-full shrink-0",
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
                  "flex w-full min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] font-semibold transition-all duration-300",
                  active
                    ? "bg-teal-50 text-health-primary shadow-sm"
                    : "text-health-text-secondary hover:bg-slate-50/90",
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
