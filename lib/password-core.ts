import { scryptSync, timingSafeEqual } from "crypto";
import { compareSync, genSaltSync, hashSync } from "bcryptjs";

const KEY_LEN = 64;
const BCRYPT_ROUNDS = 12;

/**
 * Основной формат: bcrypt hash (`$2a$`, `$2b$`, `$2y$`).
 * Legacy format (still supported for login): `scrypt$<salt b64url>$<key b64url>`.
 */
export function hashPassword(plain: string): string {
  const salt = genSaltSync(BCRYPT_ROUNDS);
  return hashSync(plain, salt);
}

export function verifyPassword(plain: string, stored: string): boolean {
  // Current bcrypt format
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    try {
      return compareSync(plain, stored);
    } catch {
      return false;
    }
  }

  // Backward compatibility for legacy scrypt hashes
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
