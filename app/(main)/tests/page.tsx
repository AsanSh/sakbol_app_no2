"use client";

import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

export default function TestsPage() {
  const { lang } = useLanguage();
  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-6">
      <h1 className="text-2xl font-semibold text-emerald-950">{t(lang, "tests.title")}</h1>
      <p className="mt-2 text-sm text-emerald-900/70">{t(lang, "tests.subtitle")}</p>
    </div>
  );
}
