"use client";

import { HeartPulse } from "lucide-react";
import { APP_NAME } from "@/constants";

/** Верхняя полоса для обычного мобильного браузера (не TWA): бренд + safe-area. */
export function MobileBrowserChrome() {
  return (
    <header
      className="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b border-slate-200/90 bg-white/95 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] backdrop-blur-md"
      role="banner"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#004253] to-[#005b71] text-white">
        <HeartPulse size={18} strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="font-manrope text-sm font-extrabold text-[#004253]">{APP_NAME}</p>
        <p className="text-[10px] text-[#70787d]">Веб · мобилдик көрүнүш</p>
      </div>
    </header>
  );
}
