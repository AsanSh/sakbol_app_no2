"use client";

import type { ReactNode } from "react";
import { ActiveProfileProvider } from "@/context/active-profile-context";
import { LanguageProvider } from "@/context/language-context";
import { TelegramSessionProvider } from "@/context/telegram-session-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TelegramSessionProvider>
      <LanguageProvider>
        <ActiveProfileProvider>{children}</ActiveProfileProvider>
      </LanguageProvider>
    </TelegramSessionProvider>
  );
}
