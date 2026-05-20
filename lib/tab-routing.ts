export type MainTab =
  | "home"
  | "analyses"
  | "insights"
  | "patients"
  | "pharmacy"
  | "doctors"
  | "profile";

export type InsightsView = "trends" | "ai";

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

/** Парсинг `?tab=` и legacy-параметров на главной `/`. */
export function parseUrlTabState(
  searchParams: Pick<URLSearchParams, "get">,
  pathname: string,
): { tab: MainTab; insightsView: InsightsView } {
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
  return { tab: "analyses", insightsView: "trends" };
}
