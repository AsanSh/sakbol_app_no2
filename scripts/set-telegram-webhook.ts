/**
 * Установить webhook для бота (после деплоя).
 *
 * Usage:
 *   WEBHOOK_BASE_URL=https://adventory.store TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npx tsx scripts/set-telegram-webhook.ts
 *
 * Или на Vercel (Preview): подставьте URL превью в WEBHOOK_BASE_URL.
 */
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

function baseUrl(): string | null {
  const explicit = process.env.WEBHOOK_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return null;
}

async function main() {
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is required");
    process.exit(1);
  }
  const base = baseUrl();
  if (!base) {
    console.error("Set WEBHOOK_BASE_URL (e.g. https://adventory.store) or deploy on Vercel (VERCEL_URL)");
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
