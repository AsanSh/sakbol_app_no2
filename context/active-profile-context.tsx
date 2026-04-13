"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "sakbol-active-profile-context-v1";

type ActiveProfileContextValue = {
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;
  /** Alias for clarity (Шаг 2): switch whose health data the app shows. */
  switchProfile: (id: string) => void;
};

const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(null);

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { activeProfileId?: string | null };
        if (typeof parsed.activeProfileId === "string" || parsed.activeProfileId === null) {
          setActiveProfileIdState(parsed.activeProfileId);
        }
      }
    } catch {
      /* ignore */
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ activeProfileId }),
      );
    } catch {
      /* ignore */
    }
  }, [activeProfileId, storageReady]);

  const setActiveProfileId = useCallback((id: string | null) => {
    setActiveProfileIdState(id);
  }, []);

  const switchProfile = useCallback((id: string) => {
    setActiveProfileIdState(id);
  }, []);

  const value = useMemo(
    () => ({
      activeProfileId,
      setActiveProfileId,
      switchProfile,
    }),
    [activeProfileId, setActiveProfileId, switchProfile],
  );

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
    </ActiveProfileContext.Provider>
  );
}

export function useActiveProfile() {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) {
    throw new Error("useActiveProfile must be used within ActiveProfileProvider");
  }
  return ctx;
}
