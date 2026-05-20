import { describe, expect, it } from "vitest";
import { normalizeWebLoginPhoneDigits } from "./phone-digits-normalize";

describe("normalizeWebLoginPhoneDigits", () => {
  it("normalizes KG numbers", () => {
    expect(normalizeWebLoginPhoneDigits("+996 555 123 456")).toBe("996555123456");
    expect(normalizeWebLoginPhoneDigits("0555123456")).toBe("996555123456");
    expect(normalizeWebLoginPhoneDigits("555123456")).toBe("996555123456");
  });

  it("rejects bare 9-digit telegram-like ids", () => {
    expect(normalizeWebLoginPhoneDigits("123456789")).toBeNull();
  });

  it("rejects too short", () => {
    expect(normalizeWebLoginPhoneDigits("12345")).toBeNull();
  });
});
