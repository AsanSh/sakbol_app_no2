"use client";

import { motion } from "framer-motion";
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
  const device = useDeviceType();
  const isDesktopWeb = device === "desktop-web";

  const headerSwitcher =
    authReady && isAuthenticated && family?.profiles?.length ? (
      <FamilySwitcher
        variant="header"
        profiles={family.profiles}
        canAddMember={false}
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
        {!authReady ? (
          <p className="text-body text-health-text-secondary">{t(lang, "analyses.loading")}</p>
        ) : null}

        {authReady && !isAuthenticated ? (
          <div className="rounded-2xl bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/80">
            <p className="font-semibold">{t(lang, "dashboard.authTitle")}</p>
            <p className="mt-1 text-caption text-amber-900/90">
              {state.status === "unauthenticated" && state.reason === "no_init_data"
                ? t(lang, "dashboard.authBodyNoTg")
                : state.status === "unauthenticated" && state.reason === "telegram_init_data_missing"
                  ? t(lang, "dashboard.tgLoginHint")
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
            hidePreviewHeader
          />
        ) : null}
      </motion.div>
    </div>
  );
}
