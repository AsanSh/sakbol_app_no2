import { describe, expect, it } from "vitest";
import { EMAIL_RE, normalizeEmail } from "./auth-email";

describe("auth-email", () => {
  it("normalizes email", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("validates format", () => {
    expect(EMAIL_RE.test("a@b.co")).toBe(true);
    expect(EMAIL_RE.test("bad")).toBe(false);
    expect(EMAIL_RE.test("@no.com")).toBe(false);
  });
});
