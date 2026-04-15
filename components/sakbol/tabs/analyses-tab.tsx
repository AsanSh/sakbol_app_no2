"use client";

import { useState } from "react";
import { FamilyAnalysesWorkspace } from "@/components/family-analyses-workspace";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

type Props = {
  onAnalysesChanged?: () => void;
};

export function AnalysesTab({ onAnalysesChanged }: Props) {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated, state } = useTelegramSession();
  const [uploadSignal, setUploadSignal] = useState(0);

  return (
    <div className="w-full">
      <SakbolTopBar
        title="Анализы"
        rightSlot={
          <button
            type="button"
            onClick={() => setUploadSignal((n) => n + 1)}
            className="rounded-full bg-gradient-to-r from-[#004253] to-[#005b71] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm"
          >
            + Загрузить
          </button>
        }
      />
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-4 pt-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#70787d]">
            Медицинские данные
          </p>
          <h2 className="font-manrope text-xl font-extrabold text-[#191c1d]">Мои анализы</h2>
          <p className="mt-1 text-sm text-[#40484c]">
            Загрузка, динамика и ИИ-подсказки по активному профилю семьи.
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
            onAnalysesChanged={onAnalysesChanged}
            uploadSignal={uploadSignal}
          />
        ) : null}
      </div>
    </div>
  );
}
