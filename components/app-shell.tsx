"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

function FooterDisclaimer() {
  const { lang } = useLanguage();
  return (
    <div className="mx-auto mb-2 flex w-full max-w-lg shrink-0 items-center justify-center px-4 text-center text-[10px] text-emerald-900/75">
      <span>{t(lang, "footer.disclaimer")}</span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-mint/35 via-mint/20 to-white text-emerald-950">
      <main className="flex flex-1 flex-col pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>
      <FooterDisclaimer />
      <BottomNav />
    </div>
  );
}
