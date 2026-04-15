"use client";

import { HealthHubPanel } from "@/components/health-hub-panel";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useLanguage } from "@/context/language-context";
import { useTabApp } from "@/context/tab-app-context";
import type { FamilyWithProfiles } from "@/types/family";
import { t } from "@/lib/i18n";

type Props = {
  family: FamilyWithProfiles | null;
  familyLoading: boolean;
  analysesRefreshKey: number;
};

export function RisksTab({ family, familyLoading, analysesRefreshKey }: Props) {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated, state } = useTelegramSession();
  const { setTab } = useTabApp();

  const profiles = family?.profiles ?? [];
  const hasProfiles = profiles.length > 0;

  return (
    <div className="w-full">
      <SakbolTopBar title="Риски" />
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-4 pt-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#70787d]">
            Персональный анализ
          </p>
          <h2 className="font-manrope text-xl font-extrabold text-[#191c1d]">Оценка рисков</h2>
          <p className="mt-1 text-sm text-[#40484c]">
            {hasProfiles
              ? "Модели на основе анализов и профиля; не заменяют врача."
              : "Добавьте профиль семьи и загрузите анализы — оценки станут точнее."}
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

        {authReady && isAuthenticated && !familyLoading && !hasProfiles ? (
          <button
            type="button"
            onClick={() => setTab("analyses")}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#d4e6e9] bg-[#d4e6e9]/40 p-4 text-left"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#004253] shadow-sm">
              <MaterialIcon name="biotech" className="text-[28px]" />
            </div>
            <div>
              <p className="font-manrope font-bold text-[#004253]">Нет профилей</p>
              <p className="text-xs text-[#40484c]">Создайте семью на вкладке «Анализы» или «Профиль».</p>
            </div>
            <MaterialIcon name="chevron_right" className="ml-auto text-[#70787d]" />
          </button>
        ) : null}

        {authReady && isAuthenticated && familyLoading ? (
          <p className="text-sm text-[#70787d]">{t(lang, "analyses.loading")}</p>
        ) : null}

        {authReady && isAuthenticated && !familyLoading && hasProfiles ? (
          <HealthHubPanel profiles={profiles} refreshKey={analysesRefreshKey} />
        ) : null}

        <div className="rounded-2xl border border-[#e7e8e9] bg-white p-4 text-[11px] leading-relaxed text-[#70787d] shadow-sm">
          <p className="font-manrope font-bold text-[#191c1d]">Как рассчитываются риски?</p>
          <p className="mt-2">
            Показатели сопоставляются с референсами и эвристическими моделями (в т.ч. ориентирами ВОЗ).
            При новых анализах профиль обновляется автоматически. Это образовательный инструмент, не
            диагноз.
          </p>
        </div>
      </div>
    </div>
  );
}
