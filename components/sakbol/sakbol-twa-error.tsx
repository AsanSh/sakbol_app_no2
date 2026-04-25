"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { SakbolMark } from "@/components/sakbol/sakbol-mark";
import { useTelegramSession } from "@/context/telegram-session-context";

/**
 * Экран ошибки авторизации в Telegram Mini App.
 * Показывается когда initData не пришёл или сервер не смог проверить подпись.
 * Никогда не показывается в обычном браузере (там используется обычный /login).
 */
export function SakbolTwaErrorScreen({ reason }: { reason: string }) {
  const { refresh } = useTelegramSession();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-amber-50 via-white to-slate-50 px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-7 shadow-2xl shadow-amber-900/10 text-center">
        <SakbolMark size="lg" className="mx-auto" />
        <div className="mt-4 flex items-center justify-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
          <h1 className="font-manrope text-base font-bold text-amber-900">
            Не удалось войти автоматически
          </h1>
        </div>
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-left text-[12px] leading-relaxed text-amber-900 ring-1 ring-amber-200">
          {reason}
        </p>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          Что попробовать:
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-left text-[11px] text-slate-600">
          <li>Закрыть мини-приложение и открыть заново через меню бота.</li>
          <li>Нажать «Повторить» ниже.</li>
          <li>Если ошибка повторяется — напишите /start боту и откройте мини-приложение из его меню.</li>
        </ul>
        <button
          type="button"
          onClick={refresh}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#004253] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#003845]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Повторить
        </button>
      </div>
    </main>
  );
}
