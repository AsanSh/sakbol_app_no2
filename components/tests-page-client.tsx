"use client";

import { useState } from "react";
import { FamilyAnalysesWorkspace } from "@/components/family-analyses-workspace";
import { useAnalysesRefresh } from "@/context/analyses-refresh-context";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

/**
 * Полноценная страница /tests: загрузка через uploadHealthRecord (модалка в FamilyAnalysesWorkspace),
 * список анализов из БД, без редиректа и без заглушки «в разработке».
 */
export function TestsPageClient() {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated, state } = useTelegramSession();
  const { bumpAnalyses } = useAnalysesRefresh();
  const [uploadSignal, setUploadSignal] = useState(0);

  return (
    <div className="flex min-h-dvh flex-col bg-[#f8f9fa] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-6">
      <SakbolTopBar
        title="Анализы"
        rightSlot={
          <button
            type="button"
            onClick={() => setUploadSignal((n) => n + 1)}
            className="rounded-full bg-sakbol-cta px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-coral/30"
          >
            Загрузить
          </button>
        }
      />
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-4 pt-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#70787d]">Лаборатория</p>
          <h1 className="font-manrope text-xl font-extrabold text-[#191c1d]">Загрузка анализов</h1>
          <p className="mt-1 text-sm text-[#40484c]">
            Выберите PDF или фото — показатели появятся в списке ниже (без ключа OpenAI через ~3 с
            подставляются демо-значения: гемоглобин, витамин D и др.).
          </p>
        </div>

        {!authReady ? (
          <p className="text-sm text-[#70787d]">{t(lang, "analyses.loading")}</p>
        ) : null}

        {authReady && !isAuthenticated ? (
          <div className="rounded-2xl border border-[#ffdcc0] bg-[#ffdcc0]/50 px-4 py-3 text-sm text-[#2d1600]">
            <p className="font-medium">{t(lang, "dashboard.authTitle")}</p>
            <p className="mt-1 text-xs text-[#693c08]">
              {state.status === "unauthenticated" && state.reason === "no_init_data"
                ? t(lang, "dashboard.authBodyNoTg")
                : t(lang, "dashboard.authBody")}
            </p>
          </div>
        ) : null}

        {authReady && isAuthenticated ? (
          <FamilyAnalysesWorkspace
            showDemoSeedButton
            showPremiumCta
            compactUpload={false}
            uploadSignal={uploadSignal}
            onAnalysesChanged={bumpAnalyses}
          />
        ) : null}
      </div>
    </div>
  );
}
