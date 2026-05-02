"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type MainTab =
  | "home"
  | "analyses"
  | "insights"
  | "patients"
  | "pharmacy"
  | "doctors"
  | "profile";

export type InsightsView = "trends" | "ai";

/** Только для URL-роутинга; legacy tab=trends|ai маппится на insights. */
const VALID_TABS = new Set<string>([
  "home",
  "analyses",
  "insights",
  "patients",
  "pharmacy",
  "doctors",
  "profile",
  "trends",
  "ai",
]);

type TabAppContextValue = {
  tab: MainTab;
  setTab: (t: MainTab) => void;
  insightsView: InsightsView;
  setInsightsView: (v: InsightsView) => void;
};

const TabAppContext = createContext<TabAppContextValue | null>(null);

function parseUrlTabState(searchParams: URLSearchParams, pathname: string): {
  tab: MainTab;
  insightsView: InsightsView;
} {
  if (pathname !== "/") {
    return { tab: "home", insightsView: "trends" };
  }
  const raw = searchParams.get("tab");
  if (raw === "risks") return { tab: "home", insightsView: "trends" };
  if (raw === "trends") return { tab: "insights", insightsView: "trends" };
  if (raw === "ai") return { tab: "insights", insightsView: "ai" };
  const insightsParam = searchParams.get("insights");
  const insightsView: InsightsView = insightsParam === "ai" ? "ai" : "trends";
  if (raw === "insights") {
    return { tab: "insights", insightsView };
  }
  if (raw && ["home", "analyses", "patients", "pharmacy", "doctors", "profile"].includes(raw)) {
    return { tab: raw as MainTab, insightsView: "trends" };
  }
  if (raw && VALID_TABS.has(raw)) {
    return { tab: raw as MainTab, insightsView: "trends" };
  }
  return { tab: "home", insightsView: "trends" };
}

function TabAppProviderInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromUrl = useMemo(
    () => parseUrlTabState(searchParams, pathname),
    [pathname, searchParams],
  );

  const [tabOverride, setTabOverride] = useState<MainTab | null>(null);

  useEffect(() => {
    setTabOverride(null);
  }, [fromUrl.tab, fromUrl.insightsView, pathname, searchParams]);

  const tab = tabOverride ?? fromUrl.tab;
  const insightsView = fromUrl.insightsView;

  const replaceQuery = useCallback(
    (mutate: (q: URLSearchParams) => void) => {
      const raw =
        typeof window !== "undefined" && window.location.pathname === pathname
          ? window.location.search
          : `?${searchParams.toString()}`;
      const q = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
      mutate(q);
      const qs = q.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      void router.push(href, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setTab = useCallback(
    (t: MainTab) => {
      setTabOverride(t);
      replaceQuery((q) => {
        q.set("tab", t);
        if (t === "insights") {
          if (!q.get("insights")) q.set("insights", "trends");
        } else {
          q.delete("insights");
        }
        q.delete("diary");
      });
    },
    [replaceQuery],
  );

  const setInsightsView = useCallback(
    (v: InsightsView) => {
      replaceQuery((q) => {
        q.set("tab", "insights");
        q.set("insights", v);
        q.delete("diary");
      });
    },
    [replaceQuery],
  );

  const value = useMemo(
    () => ({ tab, setTab, insightsView, setInsightsView }),
    [tab, setTab, insightsView, setInsightsView],
  );

  return <TabAppContext.Provider value={value}>{children}</TabAppContext.Provider>;
}

export function TabAppProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f8f9fa]" />}>
      <TabAppProviderInner>{children}</TabAppProviderInner>
    </Suspense>
  );
}

export function useTabApp() {
  const ctx = useContext(TabAppContext);
  if (!ctx) throw new Error("useTabApp must be used within TabAppProvider");
  return ctx;
}
