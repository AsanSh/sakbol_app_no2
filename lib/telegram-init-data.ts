import { createHmac } from "crypto";

export type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
};

/**
 * Validates Telegram Mini App initData per * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  const authDate = params.get("auth_date");
  if (authDate) {
    const ts = Number.parseInt(authDate, 10);
    if (Number.isFinite(ts)) {
      const maxAgeSec = 60 * 60 * 24;
      if (Date.now() / 1000 - ts > maxAgeSec) return false;
    }
  }

  const pairs: string[] = [];
  params.forEach((v, k) => {
    if (k === "hash") return;
    pairs.push(`${k}=${v}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return calculated === hash;
}

export function parseTelegramUserFromInitData(initData: string): TelegramWebAppUser | null {
  const params = new URLSearchParams(initData);
  const raw = params.get("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TelegramWebAppUser;
  } catch {
    return null;
  }
}

export function buildDisplayName(user: TelegramWebAppUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.join(" ").trim() || user.username || `user_${user.id}`;
}
