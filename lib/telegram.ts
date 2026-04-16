import "server-only";

import { createHash, createHmac } from "crypto";

/**
 * Проверка подписи Telegram Mini App initData — только на сервере (API route).
 * Клиент передаёт сырую строку initData; TELEGRAM_BOT_TOKEN здесь или во втором аргументе.
 * При ошибке пишет в console.error — видно в логах Vercel.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(initData: string, botToken?: string): boolean {
  const token = (botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  if (!token) {
    console.error(
      "[telegram] initData validation: TELEGRAM_BOT_TOKEN пустой (проверьте Vercel: среда деплоя и Redeploy после изменения env).",
    );
    return false;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    console.error("[telegram] initData validation: no hash field in initData");
    return false;
  }

  const authDate = params.get("auth_date");
  if (authDate) {
    const ts = Number.parseInt(authDate, 10);
    if (Number.isFinite(ts)) {
      const maxAgeSec = 60 * 60 * 24;
      if (Date.now() / 1000 - ts > maxAgeSec) {
        console.error("[telegram] initData validation: auth_date expired (>24h)");
        return false;
      }
    }
  }

  const pairs: string[] = [];
  params.forEach((v, k) => {
    if (k === "hash") return;
    pairs.push(`${k}=${v}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const calculated = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (calculated !== hash) {
    console.error(
      "[telegram] initData validation: HMAC mismatch — токен не от того бота, что открыл Mini App, битая строка initData, или неверная сборка data-check-string (см. доку Telegram).",
    );
    return false;
  }

  return true;
}

export type TelegramLoginWidgetVerifyResult =
  | { ok: true; telegramUserId: string }
  | { ok: false; error: string };

/**
 * Проверка данных виджета «Login with Telegram» (редирект на data-auth-url с query-параметрами).
 * Алгоритм отличается от Mini App initData (см. доку).
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramLoginWidgetParams(
  params: URLSearchParams,
  botToken?: string,
): TelegramLoginWidgetVerifyResult {
  const token = (botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN missing" };
  }

  const hash = params.get("hash");
  if (!hash) {
    return { ok: false, error: "hash missing" };
  }

  const authDate = params.get("auth_date");
  if (authDate) {
    const ts = Number.parseInt(authDate, 10);
    if (Number.isFinite(ts) && Date.now() / 1000 - ts > 86400) {
      return { ok: false, error: "auth_date expired" };
    }
  }

  const pairs: string[] = [];
  params.forEach((v, k) => {
    if (k === "hash") return;
    pairs.push(`${k}=${v}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = createHash("sha256").update(token).digest();
  const calculated = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (calculated !== hash) {
    return { ok: false, error: "HMAC mismatch" };
  }

  const id = params.get("id");
  if (!id) {
    return { ok: false, error: "id missing" };
  }

  return { ok: true, telegramUserId: String(id) };
}
