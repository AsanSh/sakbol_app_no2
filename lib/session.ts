import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "sakbol_session";
const SEP = ".";

/** Совпадает с `maxAge` cookie — токен старше этого срока отклоняется. */
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "development") {
    return "dev-only-session-secret-min-16-chars";
  }
  throw new Error("SESSION_SECRET must be set (min 16 chars).");
}

export type SessionPayload = {
  profileId: string;
  familyId: string;
};

function signPayload(payload: SessionPayload): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: Date.now() }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}${SEP}${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const i = token.lastIndexOf(SEP);
    if (i <= 0) return null;
    const body = token.slice(0, i);
    const sig = token.slice(i + 1);
    const expected = createHmac("sha256", secret()).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload & {
      iat?: number;
    };
    if (!data.profileId || !data.familyId) return null;
    if (typeof data.iat === "number" && Date.now() - data.iat > SESSION_MAX_AGE_MS) {
      return null;
    }
    return { profileId: data.profileId, familyId: data.familyId };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE)?.value;
  if (!raw) return null;
  return verifySessionToken(raw);
}

export function sessionCookieName(): typeof COOKIE {
  return COOKIE;
}

export function createSessionToken(payload: SessionPayload): string {
  return signPayload(payload);
}

export function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
