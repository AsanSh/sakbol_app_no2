"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";
import { FamilyAnalysesWorkspace } from "@/components/family-analyses-workspace";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useTelegramSession } from "@/context/telegram-session-context";
import { useLanguage } from "@/context/language-context";
import { useDeviceType } from "@/hooks/use-device-type";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  onAnalysesChanged?: () => void;
};

export function TrendsTab({ onAnalysesChanged }: Props) {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated, state } = useTelegramSession();
  const [uploadSignal, setUploadSignal] = useState(0);
  const device = useDeviceType();
  const isDesktopWeb = device === "desktop-web";

  return (
    <div className="w-full">
      <SakbolTopBar
        title={t(lang, "trends.tabTopBar")}
        rightSlot={
          <button
            type="button"
            onClick={() => setUploadSignal((n) => n + 1)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-health-primary px-4 py-2 text-caption font-semibold text-white shadow-md shadow-teal-900/15 transition-all duration-300 hover:bg-teal-700"
          >
            <Upload className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            {t(lang, "tests.uploadBig")}
          </button>
        }
      />
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
            {t(lang, "trends.tabTopBar")}
          </p>
          <h2 className="mt-1 font-manrope text-h2 font-bold tracking-tight text-health-text">
            {t(lang, "trends.tabHeroTitle")}
          </h2>
          <p className="mt-2 max-w-2xl text-body leading-relaxed text-health-text-secondary">
            {t(lang, "trends.tabHeroSubtitle")}
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
            showPremiumCta={false}
            compactUpload={false}
            variant="trends"
            onAnalysesChanged={onAnalysesChanged}
            uploadSignal={uploadSignal}
          />
        ) : null}
      </motion.div>
    </div>
  );
}
