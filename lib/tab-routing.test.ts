import { describe, expect, it } from "vitest";
import { parseUrlTabState } from "./tab-routing";

function params(qs: string) {
  return new URLSearchParams(qs);
}

describe("parseUrlTabState", () => {
  it("defaults on /", () => {
    expect(parseUrlTabState(params(""), "/")).toEqual({ tab: "analyses", insightsView: "trends" });
  });

  it("parses main tabs", () => {
    expect(parseUrlTabState(params("tab=home"), "/")).toEqual({ tab: "home", insightsView: "trends" });
    expect(parseUrlTabState(params("tab=pharmacy"), "/")).toEqual({
      tab: "pharmacy",
      insightsView: "trends",
    });
  });

  it("maps legacy trends/ai to insights", () => {
    expect(parseUrlTabState(params("tab=trends"), "/")).toEqual({
      tab: "insights",
      insightsView: "trends",
    });
    expect(parseUrlTabState(params("tab=ai"), "/")).toEqual({ tab: "insights", insightsView: "ai" });
    expect(parseUrlTabState(params("tab=insights&insights=ai"), "/")).toEqual({
      tab: "insights",
      insightsView: "ai",
    });
  });

  it("non-root path yields home tab state", () => {
    expect(parseUrlTabState(params("tab=profile"), "/tests")).toEqual({
      tab: "home",
      insightsView: "trends",
    });
  });
});
