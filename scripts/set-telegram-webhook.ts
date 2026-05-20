/**
 * Установить webhook для бота (после деплоя).
 *
 * Usage:
 *   WEBHOOK_BASE_URL=https://adventory.store TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npx tsx scripts/set-telegram-webhook.ts
 *
 */
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

function baseUrl(): string | null {
  const explicit = process.env.WEBHOOK_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (app) return app.replace(/\/$/, "");
  return null;
}

async function main() {
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is required");
    process.exit(1);
  }
  const base = baseUrl();
  if (!base) {
    console.error("Set WEBHOOK_BASE_URL or NEXT_PUBLIC_APP_URL (e.g. https://adventory.store)");
    process.exit(1);
  }
  const url = `${base}/api/telegram/webhook`;
  const body: Record<string, unknown> = { url };
  if (secret) {
    body.secret_token = secret;
  } else {
    console.warn("TELEGRAM_WEBHOOK_SECRET empty — webhook will accept requests without secret (not recommended in production)");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as { ok?: boolean; description?: string };
  if (!j.ok) {
    console.error("setWebhook failed:", j.description ?? res.status);
    process.exit(1);
  }
  console.log("OK webhook →", url);
}

void main();
