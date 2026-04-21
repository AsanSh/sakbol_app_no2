import { NextRequest, NextResponse } from "next/server";
import type { HealthDocumentCategory } from "@prisma/client";
import { createHealthDocumentForProfile } from "@/lib/health-document-create";
import { prisma } from "@/lib/prisma";
import { telegramDownloadFile, telegramSendPlainMessage } from "@/lib/telegram-bot-api";

export const dynamic = "force-dynamic";

type TgDocument = { file_id: string; file_name?: string; mime_type?: string };
type TgPhotoSize = { file_id: string; width: number; height: number };

type TgMessage = {
  message?: {
    chat?: { id: number; type?: string };
    from?: { id: number; first_name?: string };
    text?: string;
    caption?: string;
    document?: TgDocument;
    photo?: TgPhotoSize[];
  };
};

function extractStartCode(text: string): string | null {
  const t = text.trim();
  const m = /^\/start(?:\s+(\S+))?$/i.exec(t);
  const arg = m?.[1]?.trim();
  if (!arg) return null;
  const digits = arg.replace(/\D/g, "");
  if (digits.length >= 5 && digits.length <= 8) return digits.slice(0, 8);
  return null;
}

function pickMimeFromName(name: string | undefined, fallback: string): string {
  const n = (name ?? "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  return fallback;
}

/**
 * Webhook Telegram Bot API. В BotFather: setWebhook URL + secret_token (как TELEGRAM_WEBHOOK_SECRET).
 * Обрабатывает /start КОД (привязка) и входящие файлы → HealthDocument.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !secret) {
    return NextResponse.json({ error: "TELEGRAM_WEBHOOK_SECRET required" }, { status: 503 });
  }
  if (secret) {
    const hdr = req.headers.get("x-telegram-bot-api-secret-token");
    if (hdr !== secret) {
      return new NextResponse("forbidden", { status: 403 });
    }
  }

  let update: TgMessage;
  try {
    update = (await req.json()) as TgMessage;
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  const fromId = msg?.from?.id;

  if (chatId == null || fromId == null) {
    return NextResponse.json({ ok: true });
  }

  const text = msg?.text;

  if (text) {
    const code = extractStartCode(text);
    if (code) {
      const tgUserId = String(fromId);
      const now = new Date();

      try {
        const result = await prisma.$transaction(async (tx) => {
          const row = await tx.telegramLinkCode.findFirst({
            where: {
              code,
              consumedAt: null,
              expiresAt: { gt: now },
            },
          });

          if (!row) {
            return { type: "invalid" as const };
          }

          const profile = await tx.profile.findUnique({
            where: { id: row.profileId },
          });

          if (!profile) {
            return { type: "invalid" as const };
          }

          if (profile.telegramUserId) {
            return { type: "already_profile" as const, chatId };
          }

          const taken = await tx.profile.findUnique({
            where: { telegramUserId: tgUserId },
          });

          if (taken && taken.id !== profile.id) {
            return { type: "tg_busy" as const, chatId };
          }

          await tx.profile.update({
            where: { id: profile.id },
            data: { telegramUserId: tgUserId },
          });

          await tx.telegramLinkCode.update({
            where: { id: row.id },
            data: { consumedAt: now },
          });

          return { type: "ok" as const, chatId, displayName: profile.displayName };
        });

        if (result.type === "ok") {
          await telegramSendPlainMessage(
            String(result.chatId),
            `✅ Аккаунт «${result.displayName}» привязан к Telegram. Откройте SakBol в браузере или мини-приложении.`,
          );
        } else if (result.type === "tg_busy") {
          await telegramSendPlainMessage(
            String(result.chatId),
            "Этот Telegram уже привязан к другому профилю SakBol. Обратитесь в поддержку.",
          );
        } else if (result.type === "already_profile") {
          await telegramSendPlainMessage(String(result.chatId), "Этот профиль уже был привязан ранее.");
        } else {
          await telegramSendPlainMessage(
            String(chatId),
            "Код не найден или истёк. Создайте новый код в личном кабинете на сайте (Привязать Telegram).",
          );
        }
      } catch (e) {
        console.error("telegram webhook link", e);
      }

      return NextResponse.json({ ok: true });
    }
  }

  const doc = msg?.document;
  const photos = msg?.photo;
  const fileId = doc?.file_id ?? (photos?.length ? photos[photos.length - 1]?.file_id : undefined);

  if (fileId) {
    const tgUserId = String(fromId);
    void (async () => {
      try {
        const profile = await prisma.profile.findUnique({
          where: { telegramUserId: tgUserId },
        });
        if (!profile) {
          await telegramSendPlainMessage(
            String(chatId),
            "Профиль не найден. Войдите в SakBol и привяжите Telegram в разделе «Профиль».",
          );
          return;
        }

        const downloaded = await telegramDownloadFile(fileId);
        if (!downloaded.ok) {
          await telegramSendPlainMessage(String(chatId), `Не удалось получить файл: ${downloaded.description}`);
          return;
        }

        let mime = downloaded.mime;
        if (mime === "application/octet-stream") {
          mime = pickMimeFromName(doc?.file_name, mime);
        }

        const title =
          doc?.file_name?.trim() ||
          msg?.caption?.trim() ||
          `Файл из Telegram ${new Date().toLocaleDateString("ru-RU")}`;

        const docDay = new Date();
        docDay.setHours(0, 0, 0, 0);

        let category: HealthDocumentCategory = "OTHER";
        if (mime === "application/pdf") {
          category = "ANALYSIS";
        }

        const created = await createHealthDocumentForProfile({
          profileId: profile.id,
          title,
          category,
          documentDate: docDay,
          buffer: downloaded.buffer,
          mime,
        });

        if (!created.ok) {
          await telegramSendPlainMessage(String(chatId), `Файл не сохранён: ${created.error}`);
          return;
        }

        await telegramSendPlainMessage(
          String(chatId),
          `📎 Документ сохранён в хранилище SakBol: «${title.slice(0, 120)}»`,
        );
      } catch (e) {
        console.error("telegram webhook document", e);
        await telegramSendPlainMessage(String(chatId), "Ошибка при сохранении файла. Попробуйте позже.");
      }
    })();

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
