import { NextRequest, NextResponse } from "next/server";
import { createHealthDocumentForProfile } from "@/lib/health-document-create";
import { inferHealthDocumentFields } from "@/lib/health-document-infer";
import { normalizeUploadedFilename } from "@/lib/filename-encoding";
import { prisma } from "@/lib/prisma";
import { getServerAppOrigin } from "@/lib/app-origin";
import { acceptOrDeferProfileAccessInvite } from "@/lib/profile-access-accept";
import {
  telegramDownloadFile,
  telegramSendMessageWithUrlButton,
  telegramSendPlainMessage,
} from "@/lib/telegram-bot-api";

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
  if (/^share_/i.test(arg)) return null;
  const digits = arg.replace(/\D/g, "");
  if (digits.length >= 5 && digits.length <= 8) return digits.slice(0, 8);
  return null;
}

function extractShareInviteToken(text: string): string | null {
  const t = text.trim();
  const m = /^\/start(?:\s+(\S+))?$/i.exec(t);
  const arg = m?.[1]?.trim();
  if (!arg) return null;
  if (!/^share_[0-9a-f-]{36}$/i.test(arg)) return null;
  return arg.slice("share_".length);
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
    const shareToken = extractShareInviteToken(text);
    if (shareToken) {
      try {
        const tg = String(fromId);
        const result = await acceptOrDeferProfileAccessInvite({
          inviteToken: shareToken,
          telegramUserId: tg,
        });
        const openUrl = `${getServerAppOrigin()}/share-profile/${encodeURIComponent(shareToken)}`;
        const nameFor = (n: string) => `«${n}»`;

        if (result.status === "accepted") {
          const ok = await telegramSendMessageWithUrlButton(
            String(chatId),
            `✅ Доступ к профилю ${nameFor(result.sourceName)} получен.\n\n` +
              "Откройте мини-приложение — выберите этот профиль в переключателе сверху (анализы и динамика обновятся).",
            "Открыть SakBol",
            openUrl,
          );
          if (!ok.ok) {
            await telegramSendPlainMessage(
              String(chatId),
              `✅ Доступ к ${nameFor(result.sourceName)} подключён. Откройте мини-приложение SakBol и переключите профиль вверху.`,
            );
          }
        } else if (result.status === "pending_registration") {
          const ok = await telegramSendMessageWithUrlButton(
            String(chatId),
            `✅ Приглашение к ${nameFor(result.sourceName)} сохранено.\n\n` +
              "Дальше: откройте мини-приложение и укажите ПИН/ИНН — после регистрации совместный профиль появится в переключателе.",
            "Открыть SakBol",
            openUrl,
          );
          if (!ok.ok) {
            await telegramSendPlainMessage(
              String(chatId),
              `Ссылка сохранена. Зарегистрируйтесь в SakBol (мини-приложение) с ПИН — доступ к ${nameFor(result.sourceName)} применится автоматически.`,
            );
          }
        } else if (result.status === "already_accepted" || result.status === "already_has_access") {
          await telegramSendPlainMessage(
            String(chatId),
            `У вас уже есть доступ к ${nameFor(result.sourceName)}. Откройте приложение — профиль в переключателе.`,
          );
        } else if (result.status === "invalid") {
          await telegramSendPlainMessage(
            String(chatId),
            "Приглашение не найдено или отозвано. Попросите владельца создать ссылку снова.",
          );
        } else if (result.status === "expired") {
          await telegramSendPlainMessage(
            String(chatId),
            "Срок ссылки истёк. Попросите владельца создать новое приглашение.",
          );
        } else if (result.status === "same_family") {
          await telegramSendPlainMessage(
            String(chatId),
            "Совместный доступ на профиль своей семьи оформляется иначе — этот ярлык вам не нужен.",
          );
        } else if (result.status === "busy_other_user") {
          await telegramSendPlainMessage(
            String(chatId),
            "Это приглашение уже использовано другим аккаунтом. Попросите новую ссылку.",
          );
        }
      } catch (e) {
        console.error("telegram webhook share", e);
      }
      return NextResponse.json({ ok: true });
    }

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

        const cap = msg?.caption?.trim();
        const baseTitle =
          (doc?.file_name?.trim() ? normalizeUploadedFilename(doc.file_name) : "") ||
          (cap ? normalizeUploadedFilename(cap) : "") ||
          "";

        const inferred = await inferHealthDocumentFields({
          buffer: downloaded.buffer,
          mime,
          fileBaseName: baseTitle || `telegram_${Date.now()}`,
          title: baseTitle || undefined,
          category: mime === "application/pdf" ? "ANALYSIS" : "OTHER",
        });

        const created = await createHealthDocumentForProfile({
          profileId: profile.id,
          title: inferred.title,
          category: inferred.category,
          documentDate: inferred.documentDate,
          buffer: downloaded.buffer,
          mime,
        });

        if (!created.ok) {
          await telegramSendPlainMessage(String(chatId), `Файл не сохранён: ${created.error}`);
          return;
        }

        await telegramSendPlainMessage(
          String(chatId),
          `📎 Документ сохранён в хранилище SakBol: «${inferred.title.slice(0, 120)}»`,
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
