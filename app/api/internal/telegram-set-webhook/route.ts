import { NextRequest, NextResponse } from "next/server";
import { getServerAppOrigin } from "@/lib/app-origin";

export const dynamic = "force-dynamic";

/**
 * Одноразово привязать Telegram webhook к этому деплою (пункт «после Vercel»).
 * Заголовок: Authorization: Bearer <BOT_INTERNAL_SECRET>
 *
 * Тело (опционально): { "baseUrl": "https://your-domain.vercel.app" } — если origin из env неверен.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.BOT_INTERNAL_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "BOT_INTERNAL_SECRET not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization")?.trim();
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 503 });
  }

  let baseUrl = getServerAppOrigin().replace(/\/$/, "");
  try {
    const body = (await req.json().catch(() => ({}))) as { baseUrl?: string };
    if (body.baseUrl?.trim()) {
      baseUrl = body.baseUrl.trim().replace(/\/$/, "");
    }
  } catch {
    /* ignore */
  }

  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const payload: Record<string, string> = { url: webhookUrl };
  const whSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (whSecret) {
    payload.secret_token = whSecret;
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { ok?: boolean; description?: string };

  if (!json.ok) {
    return NextResponse.json(
      {
        error: json.description ?? "setWebhook failed",
        webhookUrl,
        telegram: json,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, webhookUrl });
}
