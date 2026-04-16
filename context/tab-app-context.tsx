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

export type MainTab = "home" | "analyses" | "trends" | "ai" | "profile";

const VALID_TABS = new Set<string>(["home", "analyses", "trends", "ai", "profile"]);

type TabAppContextValue = {
  tab: MainTab;
  setTab: (t: MainTab) => void;
  diaryOpen: boolean;
  openDiary: () => void;
  closeDiary: () => void;
};

const TabAppContext = createContext<TabAppContextValue | null>(null);

function parseTab(raw: string | null): MainTab {
  if (raw === "risks") return "home";
  if (raw && VALID_TABS.has(raw)) return raw as MainTab;
  return "home";
}

function TabAppProviderInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabFromUrl = useMemo(() => {
    if (pathname !== "/") return "home";
    return parseTab(searchParams.get("tab"));
  }, [pathname, searchParams]);

  const diaryFromUrl = pathname === "/" && searchParams.get("diary") === "1";

  /** Пока URL догоняет router.push — держим выбранную вкладку в состоянии. */
  const [tabOverride, setTabOverride] = useState<MainTab | null>(null);
  const [diaryOverride, setDiaryOverride] = useState<boolean | null>(null);

  useEffect(() => {
    setTabOverride(null);
  }, [tabFromUrl, searchParams]);

  useEffect(() => {
    setDiaryOverride(null);
  }, [diaryFromUrl, searchParams]);

  const tab = tabOverride ?? tabFromUrl;
  const diaryOpen = diaryOverride ?? diaryFromUrl;

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
        q.delete("diary");
      });
    },
    [replaceQuery],
  );

  const openDiary = useCallback(() => {
    setDiaryOverride(true);
    const keepTab = tab;
    replaceQuery((q) => {
      q.set("tab", keepTab);
      q.set("diary", "1");
    });
  }, [replaceQuery, tab]);

  const closeDiary = useCallback(() => {
    setDiaryOverride(false);
    replaceQuery((q) => {
      q.delete("diary");
    });
  }, [replaceQuery]);

  const value = useMemo(
    () => ({ tab, setTab, diaryOpen, openDiary, closeDiary }),
    [tab, setTab, diaryOpen, openDiary, closeDiary],
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
