"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { AppProviders } from "@/components/app-providers";
import { LanguageSwitcher } from "@/components/language-switcher";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <div className="flex min-h-dvh flex-col bg-gradient-to-b from-mint/35 via-mint/20 to-white">
        <div className="flex flex-1 flex-col pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </div>
        <div className="mx-auto mb-2 flex w-full max-w-lg items-center justify-between px-4 text-[10px] text-emerald-900/75">
          <span>Бул маалыматтык кызмат. Диагноз эмес. Дарыгерге кайрылыңыз</span>
          <LanguageSwitcher />
        </div>
        <BottomNav />
      </div>
    </AppProviders>
  );
}
