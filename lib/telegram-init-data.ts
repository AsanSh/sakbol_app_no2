export type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
};

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
