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
        className="flex h-10 w-full rounded-[11px] bg-black/[0.06] p-[3px]"
        role="tablist"
        aria-label="Язык"
      >
        <button
          type="button"
          role="tab"
          aria-selected={lang === "ru"}
          onClick={() => pick("ru")}
          className={cn(
            "flex min-h-0 flex-1 items-center justify-center rounded-[8px] text-[13px] font-semibold tracking-tight transition-all duration-200",
            lang === "ru"
              ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.12)]"
              : "text-slate-500 hover:text-slate-800",
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
            "flex min-h-0 flex-1 items-center justify-center rounded-[8px] text-[13px] font-semibold tracking-tight transition-all duration-200",
            lang === "kg"
              ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.12)]"
              : "text-slate-500 hover:text-slate-800",
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
