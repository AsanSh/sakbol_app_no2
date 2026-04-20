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
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

type NavItem = { id: MainTab; labelKey: string; Icon: LucideIcon };

const ITEMS: NavItem[] = [
  { id: "home", labelKey: "nav.dashboard", Icon: LayoutDashboard },
  { id: "analyses", labelKey: "nav.analysesTab", Icon: Stethoscope },
  { id: "trends", labelKey: "nav.trends", Icon: TrendingUp },
  { id: "profile", labelKey: "nav.familyTab", Icon: Users },
  { id: "ai", labelKey: "nav.aiDoctor", Icon: BotMessageSquare },
];

/**
 * Левый сайдбар SaaS-дашборда: подписи, спокойная палитра, крупные зоны клика.
 */
export function SakbolDesktopSidebar() {
  const { tab, setTab } = useTabApp();
  const { lang } = useLanguage();

  return (
    <aside
      className="sticky top-0 flex h-dvh w-[15.5rem] shrink-0 flex-col border-r border-health-border/90 bg-health-surface shadow-health-soft"
      aria-label="Основное меню"
    >
      <div className="flex items-start gap-3 px-5 py-6">
        <SakbolMark size="md" className="h-11 w-11 shrink-0 shadow-md shadow-teal-900/20 ring-teal-100" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-manrope text-sm font-bold tracking-tight text-health-text">
              {t(lang, "brand.name")}
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-health-text-secondary ring-1 ring-health-border/60">
              {t(lang, "brand.countryBadge")}
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium leading-snug text-health-text-secondary">
            {t(lang, "brand.tagline")}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
        {ITEMS.map(({ id, labelKey, Icon }) => {
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
                "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-body font-medium transition-all duration-300",
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
              <span className="truncate">{t(lang, labelKey)}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto h-2 shrink-0 border-t border-health-border/60" aria-hidden />
    </aside>
  );
}
