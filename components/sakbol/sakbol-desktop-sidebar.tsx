"use client";

import {
  LayoutDashboard,
  Stethoscope,
  TrendingUp,
  Users,
  BotMessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SakbolMark } from "@/components/sakbol/sakbol-mark";
import { hapticImpact } from "@/lib/telegram-haptics";
import type { MainTab } from "@/context/tab-app-context";
import { useTabApp } from "@/context/tab-app-context";

type NavItem = { id: MainTab; label: string; Icon: LucideIcon };

const ITEMS: NavItem[] = [
  { id: "home", label: "Дашборд", Icon: LayoutDashboard },
  { id: "analyses", label: "Анализы", Icon: Stethoscope },
  { id: "trends", label: "Динамика", Icon: TrendingUp },
  { id: "profile", label: "Семья", Icon: Users },
  { id: "ai", label: "ИИ-врач", Icon: BotMessageSquare },
];

/**
 * Левый сайдбар SaaS-дашборда: подписи, спокойная палитра, крупные зоны клика.
 */
export function SakbolDesktopSidebar() {
  const { tab, setTab } = useTabApp();

  return (
    <aside
      className="sticky top-0 flex h-dvh w-[15.5rem] shrink-0 flex-col border-r border-health-border/90 bg-health-surface shadow-health-soft"
      aria-label="Основное меню"
    >
      <div className="flex items-center gap-3 px-5 py-6">
        <SakbolMark size="md" className="h-11 w-11 shadow-md shadow-teal-900/20 ring-teal-100" />
        <div className="min-w-0">
          <p className="font-manrope text-sm font-bold tracking-tight text-health-text">Sakbol</p>
          <p className="text-caption font-medium text-health-text-secondary">Medical</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
        {ITEMS.map(({ id, label, Icon }) => {
          const highlighted = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                hapticImpact("light");
                setTab(id);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-body font-medium transition-all duration-300",
                highlighted
                  ? "bg-teal-50 text-health-primary shadow-sm ring-1 ring-teal-100"
                  : "text-health-text-secondary hover:bg-slate-50 hover:text-health-text",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  highlighted ? "text-health-primary" : "text-health-text-secondary",
                )}
                strokeWidth={highlighted ? 2.25 : 2}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-health-border/80 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-health-text-secondary">
          Кыргызстан
        </p>
        <p className="mt-0.5 text-caption text-health-text-secondary">Медицинский портал</p>
      </div>
    </aside>
  );
}
