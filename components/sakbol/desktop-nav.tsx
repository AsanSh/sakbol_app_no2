"use client";

import { cn } from "@/lib/utils";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import type { MainTab } from "@/context/tab-app-context";
import { useTabApp } from "@/context/tab-app-context";

const ITEMS: { id: MainTab; label: string; icon: string }[] = [
  { id: "home", label: "Главная", icon: "grid_view" },
  { id: "analyses", label: "Анализы", icon: "biotech" },
  { id: "risks", label: "Риски", icon: "monitor_heart" },
  { id: "ai", label: "ИИ", icon: "smart_toy" },
  { id: "profile", label: "Профиль", icon: "person" },
];

export function SakbolDesktopNav() {
  const { tab, setTab } = useTabApp();

  return (
    <aside
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-[#e7e8e9] bg-white/90 backdrop-blur-md md:flex"
      aria-label="Меню"
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#004253] to-[#005b71] text-sm font-extrabold text-white font-manrope">
          S
        </div>
        <div>
          <p className="font-manrope text-base font-extrabold text-[#004253]">Sakbol</p>
          <p className="text-[10px] text-[#70787d]">Кыргызстан</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {ITEMS.map(({ id, label, icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                active
                  ? "bg-cyan-50/90 text-[#004253]"
                  : "text-slate-500 hover:bg-slate-50",
              )}
            >
              <MaterialIcon name={icon} filled={active} className="text-[22px]" />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
