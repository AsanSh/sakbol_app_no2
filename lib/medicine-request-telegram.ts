import "server-only";

import { prisma } from "@/lib/prisma";
import { getServerAppOrigin } from "@/lib/app-origin";
import { telegramSendMessageWithUrlButtons, telegramSendPlainMessage } from "@/lib/telegram-bot-api";
import {
  telegramBotUsernameFromEnv,
  telegramMiniAppStartUrlFromEnv,
} from "@/lib/telegram-public-urls";

function mapsUrl(address: string, lat: number | null, lng: number | null): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
}

/** Уведомить все активные аптеки с привязанным чатом бота о новой заявке. */
export async function notifyPharmaciesNewMedicineRequest(input: {
  medicineName: string;
  note: string | null;
}): Promise<void> {
  const appUrl = `${getServerAppOrigin()}/?tab=pharmacy`;
  const mini = telegramMiniAppStartUrlFromEnv();

  const pharmacies = await prisma.pharmacy.findMany({
    where: { isActive: true, telegramNotifyChatId: { not: null } },
    select: { telegramNotifyChatId: true },
  });

  const text =
    `🏥 SakBol · фармпоиск\n` +
    `💊 Новый запрос от пациента\n\n` +
    `Ищут: «${input.medicineName}»` +
    (input.note?.trim() ? `\n📝 ${input.note.trim()}` : "") +
    `\n\nОткройте кабинет аптеки → открытые заявки и ответьте.`;

  const buttons: Array<{ text: string; url: string }> = [];
  if (mini) buttons.push({ text: "✅ Ответить в 1 клик", url: mini });
  buttons.push({ text: "SakBol на сайте", url: appUrl });

  await Promise.allSettled(
    pharmacies.map((p) =>
      p.telegramNotifyChatId
        ? telegramSendMessageWithUrlButtons(p.telegramNotifyChatId, text, buttons)
        : Promise.resolve({ ok: true as const }),
    ),
  );
}

/** Личное сообщение пользователю (Telegram): ответ аптеки. */
export async function notifyUserMedicineResponse(input: {
  telegramUserId: string;
  pharmacyName: string;
  address: string;
  city: string;
  workHours: string | null;
  medicineName: string;
  inStock: boolean;
  price: number | null;
  priceUnit: string | null;
  note: string | null;
  phones: string[];
  latitude: number | null;
  longitude: number | null;
}): Promise<{ ok: true } | { ok: false; description: string }> {
  const chatId = input.telegramUserId;
  const addrLine = `${input.address}, ${input.city}`.trim();

  let msg =
    `✅ Аптека «${input.pharmacyName}» ответила на запрос «${input.medicineName}»\n\n` +
    `📍 ${addrLine}\n` +
    (input.inStock ? "✅ Указано: в наличии\n" : "❌ Указано: нет в наличии\n");

  if (input.price != null) {
    msg += `💰 Цена: ${input.price} ${input.priceUnit ?? "сом"}\n`;
  }
  if (input.workHours?.trim()) {
    msg += `🕐 ${input.workHours.trim()}\n`;
  }
  if (input.note?.trim()) {
    msg += `💬 ${input.note.trim()}\n`;
  }
  if (input.phones.length) {
    msg += `\n📞 Тел.: ${input.phones.join(", ")}`;
  }

  const map = mapsUrl(addrLine, input.latitude, input.longitude);
  const mini = telegramMiniAppStartUrlFromEnv();
  const appPharm = `${getServerAppOrigin()}/?tab=pharmacy`;

  const buttons: Array<{ text: string; url: string }> = [{ text: "🗺 На карте", url: map }];
  if (mini) buttons.push({ text: "SakBol", url: mini });
  buttons.push({ text: "Сайт", url: appPharm });

  return telegramSendMessageWithUrlButtons(chatId, msg, buttons);
}

/** После регистрации аптеки — напомнить владельцу написать боту для уведомлений. */
export async function notifyPharmacyOwnerLinkBot(telegramUserId: string): Promise<void> {
  const un = telegramBotUsernameFromEnv();
  const botOpen = un ? `https://t.me/${un}` : null;
  if (!botOpen) {
    await telegramSendPlainMessage(
      telegramUserId,
      "Аптека зарегистрирована в SakBol. Напишите любое сообщение боту приложения в личном чате — тогда вы будете получать новые заявки на лекарства здесь.",
    );
    return;
  }
  await telegramSendMessageWithUrlButtons(
    telegramUserId,
    "🏥 Аптека добавлена в SakBol.\n\nЧтобы получать уведомления о новых запросах, откройте чат с ботом и отправьте любое сообщение (например «ок»).",
    [{ text: "Открыть бот", url: botOpen }],
  );
}
