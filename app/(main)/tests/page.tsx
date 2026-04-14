"use client";

import { useLanguage } from "@/context/language-context";
import { useTelegramSession } from "@/context/telegram-session-context";
import { FamilyAnalysesWorkspace } from "@/components/family-analyses-workspace";
import { t } from "@/lib/i18n";

export default function TestsPage() {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated, state } = useTelegramSession();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-6">
      <header>
        <h1 className="text-2xl font-semibold text-emerald-950">{t(lang, "tests.title")}</h1>
        <p className="mt-2 text-sm text-emerald-900/70">{t(lang, "tests.subtitle")}</p>
      </header>

      {!authReady ? (
        <p className="text-sm text-emerald-900/70">{t(lang, "analyses.loading")}</p>
      ) : null}

      {authReady && !isAuthenticated ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-emerald-950">
          <p className="font-medium">{t(lang, "dashboard.authTitle")}</p>
          <p className="mt-1 text-emerald-900/80">
            {state.status === "unauthenticated" && state.reason === "no_init_data"
              ? t(lang, "dashboard.authBodyNoTg")
              : t(lang, "dashboard.authBody")}
          </p>
          {process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "true" ? (
            <p className="mt-2 text-xs text-emerald-800/90">{t(lang, "dashboard.devHint")}</p>
          ) : null}
          {state.status === "unauthenticated" && state.reason && state.reason !== "no_init_data" ? (
            <p className="mt-2 text-xs text-coral">
              {t(lang, "dashboard.errorPrefix")} {state.reason}
            </p>
          ) : null}
        </div>
      ) : null}

      {authReady && isAuthenticated ? (
        <FamilyAnalysesWorkspace showPremiumCta={false} showDemoSeedButton compactUpload={false} />
      ) : null}
    </div>
  );
}
