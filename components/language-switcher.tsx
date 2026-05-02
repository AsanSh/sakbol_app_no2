"use client";

import { hapticImpact } from "@/lib/telegram-haptics";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

type Props = {
  /** iOS-style pill inside track (default: compact RU/KG chips) */
  variant?: "default" | "segmented";
};

export function LanguageSwitcher({ variant = "default" }: Props) {
  const { lang, setLang } = useLanguage();

  const pick = (next: "ru" | "kg") => {
    if (next !== lang) hapticImpact("light");
    setLang(next);
  };

  if (variant === "segmented") {
    return (
      <div
        className="flex h-11 w-full rounded-[10px] bg-slate-100/95 p-1 ring-1 ring-slate-200/80"
        role="tablist"
        aria-label="Язык"
      >
        <button
          type="button"
          role="tab"
          aria-selected={lang === "ru"}
          onClick={() => pick("ru")}
          className={cn(
            "flex min-h-[44px] flex-1 items-center justify-center rounded-[8px] text-sm font-semibold transition-colors",
            lang === "ru"
              ? "bg-white text-[#0f172a] shadow-sm shadow-slate-900/10"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          Русский
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={lang === "kg"}
          onClick={() => pick("kg")}
          className={cn(
            "flex min-h-[44px] flex-1 items-center justify-center rounded-[8px] text-sm font-semibold transition-colors",
            lang === "kg"
              ? "bg-white text-[#0f172a] shadow-sm shadow-slate-900/10"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          Кыргызча
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-emerald-900/20 bg-white px-1 py-1 text-xs">
      <button
        type="button"
        onClick={() => pick("ru")}
        className={`rounded-full px-2 py-1 ${lang === "ru" ? "bg-emerald-900 text-mint" : "text-emerald-900"}`}
      >
        RU
      </button>
      <button
        type="button"
        onClick={() => pick("kg")}
        className={`rounded-full px-2 py-1 ${lang === "kg" ? "bg-emerald-900 text-mint" : "text-emerald-900"}`}
      >
        KG
      </button>
    </div>
  );
}
