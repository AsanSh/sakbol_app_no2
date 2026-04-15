"use client";

import type { ReactNode } from "react";
import { ActiveProfileProvider } from "@/context/active-profile-context";
import { AnalysesRefreshProvider } from "@/context/analyses-refresh-context";
import { LanguageProvider } from "@/context/language-context";
import { TelegramSessionProvider } from "@/context/telegram-session-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TelegramSessionProvider>
      <LanguageProvider>
        <AnalysesRefreshProvider>
          <ActiveProfileProvider>{children}</ActiveProfileProvider>
        </AnalysesRefreshProvider>
      </LanguageProvider>
    </TelegramSessionProvider>
  );
}
