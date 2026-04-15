"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Value = {
  refreshKey: number;
  bumpAnalyses: () => void;
};

const AnalysesRefreshContext = createContext<Value | null>(null);

export function AnalysesRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpAnalyses = useCallback(() => setRefreshKey((k) => k + 1), []);
  const value = useMemo(() => ({ refreshKey, bumpAnalyses }), [refreshKey, bumpAnalyses]);

  return (
    <AnalysesRefreshContext.Provider value={value}>{children}</AnalysesRefreshContext.Provider>
  );
}

export function useAnalysesRefresh() {
  const ctx = useContext(AnalysesRefreshContext);
  if (!ctx) {
    throw new Error("useAnalysesRefresh must be used within AnalysesRefreshProvider");
  }
  return ctx;
}
