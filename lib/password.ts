import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 64;

/** Формат: scrypt$<salt b64url>$<key b64url> */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(plain, salt, KEY_LEN);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "base64url");
    const expected = Buffer.from(parts[2], "base64url");
    const key = scryptSync(plain, salt, KEY_LEN);
    if (key.length !== expected.length) return false;
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
