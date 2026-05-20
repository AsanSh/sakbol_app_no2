import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

describe("session token", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.SESSION_SECRET = "test-session-secret-16";
  });

  it("round-trips payload", () => {
    const token = createSessionToken({ profileId: "p1", familyId: "f1" });
    const payload = verifySessionToken(token);
    expect(payload).toEqual({ profileId: "p1", familyId: "f1" });
  });

  it("rejects tampered token", () => {
    const token = createSessionToken({ profileId: "p1", familyId: "f1" });
    const bad = `${token}x`;
    expect(verifySessionToken(bad)).toBeNull();
  });
});
