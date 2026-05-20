"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { ActiveProfileProvider } from "@/context/active-profile-context";
import { AnalysesRefreshProvider } from "@/context/analyses-refresh-context";
import { LanguageProvider } from "@/context/language-context";
import { TelegramSessionProvider } from "@/context/telegram-session-context";
import { BackupLoginPrompt } from "@/components/backup-login-prompt";
import { TelegramPinGates } from "@/components/telegram-pin-gates";
import { WebAuthGate } from "@/components/web-auth-gate";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TelegramSessionProvider>
      <TelegramPinGates />
      <BackupLoginPrompt />
      <LanguageProvider>
        <AnalysesRefreshProvider>
          <ActiveProfileProvider>
            <Suspense fallback={null}>
              <WebAuthGate>{children}</WebAuthGate>
            </Suspense>
          </ActiveProfileProvider>
        </AnalysesRefreshProvider>
      </LanguageProvider>
    </TelegramSessionProvider>
  );
}
