"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FamilyRole } from "@prisma/client";
import { FamilyAnalysesWorkspace } from "@/components/family-analyses-workspace";
import { FamilySwitcher } from "@/components/family-switcher";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useLanguage } from "@/context/language-context";
import { useDeviceType } from "@/hooks/use-device-type";
import type { FamilyWithProfiles } from "@/types/family";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  family: FamilyWithProfiles | null;
  onAnalysesChanged?: () => void;
};

export function AnalysesTab({ family, onAnalysesChanged }: Props) {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated, state } = useTelegramSession();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const device = useDeviceType();
  const isDesktopWeb = device === "desktop-web";

  const admin = useMemo(
    () => family?.profiles.find((p) => p.familyRole === FamilyRole.ADMIN),
    [family?.profiles],
  );

  const headerSwitcher =
    authReady && isAuthenticated && family?.profiles?.length ? (
      <FamilySwitcher
        variant="header"
        profiles={family.profiles}
        canAddMember={!!admin}
        onAddMember={admin ? () => setAddMemberOpen(true) : undefined}
      />
    ) : null;

  return (
    <div className="w-full">
      <SakbolTopBar title="Анализы" centerSlot={headerSwitcher} />
      <motion.div
        className={cn(
          "mx-auto space-y-4 px-4 pb-6 pt-2",
          isDesktopWeb ? "max-w-5xl" : "max-w-2xl",
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <header>
          <p className="text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
            Медицинские данные
          </p>
          <h2 className="mt-1 font-manrope text-h2 font-bold tracking-tight text-health-text">
            Мои анализы
          </h2>
          <p className="mt-2 max-w-2xl text-body leading-relaxed text-health-text-secondary">
            Загрузка PDF и фото, динамика показателей и подсказки по активному профилю семьи.
          </p>
        </header>

        {!authReady ? (
          <p className="text-body text-health-text-secondary">{t(lang, "analyses.loading")}</p>
        ) : null}

        {authReady && !isAuthenticated ? (
          <div className="rounded-2xl bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/80">
            <p className="font-semibold">{t(lang, "dashboard.authTitle")}</p>
            <p className="mt-1 text-caption text-amber-900/90">
              {state.status === "unauthenticated" && state.reason === "no_init_data"
                ? t(lang, "dashboard.authBodyNoTg")
                : t(lang, "dashboard.authBody")}
            </p>
          </div>
        ) : null}

        {authReady && isAuthenticated ? (
          <FamilyAnalysesWorkspace
            showPremiumCta
            compactUpload={false}
            onAnalysesChanged={onAnalysesChanged}
            hideFamilySwitcher
            addMemberModalOpen={addMemberOpen}
            onAddMemberModalOpenChange={setAddMemberOpen}
          />
        ) : null}
      </motion.div>
    </div>
  );
}
