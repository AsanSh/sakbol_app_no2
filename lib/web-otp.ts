import "server-only";

import { createHash, randomInt, timingSafeEqual } from "crypto";

function pepper(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return `web_otp_v1:${s}`;
  if (process.env.NODE_ENV === "development") {
    return "web_otp_v1:dev-only-session-secret-min-16-chars";
  }
  throw new Error("SESSION_SECRET must be set (min 16 chars).");
}

export function generateWebOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashWebOtpCode(code: string): string {
  const normalized = code.replace(/\D/g, "").slice(0, 6);
  return createHash("sha256").update(pepper()).update(":").update(normalized).digest("hex");
}

export function verifyWebOtpCodeHash(code: string, codeHash: string): boolean {
  const h = hashWebOtpCode(code);
  try {
    const a = Buffer.from(h, "hex");
    const b = Buffer.from(codeHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
