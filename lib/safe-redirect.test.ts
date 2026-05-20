import { describe, expect, it } from "vitest";
import { safePostLoginPath } from "./safe-redirect";

describe("safePostLoginPath", () => {
  it("defaults to home", () => {
    expect(safePostLoginPath(null)).toBe("/");
    expect(safePostLoginPath("")).toBe("/");
  });

  it("allows internal paths", () => {
    expect(safePostLoginPath("/join-family?code=123456789")).toBe("/join-family?code=123456789");
    expect(safePostLoginPath("/share-profile/abc")).toBe("/share-profile/abc");
  });

  it("blocks open redirects", () => {
    expect(safePostLoginPath("https://evil.com")).toBe("/");
    expect(safePostLoginPath("//evil.com")).toBe("/");
    expect(safePostLoginPath("/login")).toBe("/");
    expect(safePostLoginPath("/login?next=/")).toBe("/");
  });
});
