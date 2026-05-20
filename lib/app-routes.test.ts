import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Статический аудит: legacy-страницы должны редиректить на вкладки главной.
 */
const LEGACY_REDIRECTS: { file: string; mustContain: string[] }[] = [
  {
    file: "app/(main)/meds/page.tsx",
    mustContain: ['redirect("/?tab=pharmacy")'],
  },
  {
    file: "app/(main)/profile/page.tsx",
    mustContain: ['redirect("/?tab=profile")'],
  },
  {
    file: "app/(main)/tests/page.tsx",
    mustContain: ['redirect("/?tab=analyses")'],
  },
  {
    file: "app/(main)/dashboard/dynamics/page.tsx",
    mustContain: ['redirect("/?tab=insights'],
  },
  {
    file: "app/(main)/dashboard/documents/page.tsx",
    mustContain: ['redirect("/?tab=analyses")'],
  },
];

describe("legacy route redirects", () => {
  for (const { file, mustContain } of LEGACY_REDIRECTS) {
    it(file, () => {
      const full = join(process.cwd(), file);
      expect(existsSync(full), `${file} missing`).toBe(true);
      const src = readFileSync(full, "utf8");
      for (const snippet of mustContain) {
        expect(src, `expected ${snippet} in ${file}`).toContain(snippet);
      }
    });
  }
});

describe("public auth gate routes", () => {
  it("web-auth-gate includes join-family", () => {
    const src = readFileSync(join(process.cwd(), "components/web-auth-gate.tsx"), "utf8");
    expect(src).toContain('pathname === "/join-family"');
  });
});

describe("mobile nav includes home tab", () => {
  it("bottom-tab-bar has home", () => {
    const src = readFileSync(join(process.cwd(), "components/sakbol/bottom-tab-bar.tsx"), "utf8");
    expect(src).toContain('id: "home"');
    expect(src).toContain("LayoutDashboard");
  });
});
