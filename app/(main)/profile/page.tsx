"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

export default function ProfilePage() {
  const { lang } = useLanguage();

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-6">
      <h1 className="text-2xl font-semibold text-emerald-950">{t(lang, "profile.title")}</h1>
      <p className="mt-2 text-sm text-emerald-900/70">{t(lang, "profile.subtitle")}</p>

      <section className="mt-8 rounded-2xl border border-emerald-900/15 bg-white/90 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-emerald-950">{t(lang, "profile.language")}</h2>
        <p className="mt-1 text-xs text-emerald-900/70">{t(lang, "profile.languageHint")}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-emerald-900">RU / KG</span>
          <LanguageSwitcher />
        </div>
      </section>
    </div>
  );
}
