import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password-core";

describe("password-core", () => {
  it("hashes and verifies bcrypt", () => {
    const hash = hashPassword("secret-password");
    expect(hash.startsWith("$2")).toBe(true);
    expect(verifyPassword("secret-password", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
});
