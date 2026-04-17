"use client";

import { motion } from "framer-motion";
import { ExternalLink, Send } from "lucide-react";
import { APP_NAME } from "@/constants";
import { SakbolMark } from "@/components/sakbol/sakbol-mark";

type Props = {
  botUser: string;
  miniAppUrl: string;
};

/**
 * Экран для вкладки, открытой внутри клиента Telegram: без виджета (он уводит в цикл Telegram).
 * Вход — через мини-приложение бота; веб-вход — в обычном браузере.
 */
export function LoginTelegramClientPanel({ botUser, miniAppUrl }: Props) {
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-white to-slate-100 px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-900/10"
      >
        <div className="flex flex-col items-center text-center">
          <SakbolMark size="lg" className="ring-[#004253]/20 shadow-md" />
          <h1 className="mt-4 font-manrope text-2xl font-extrabold text-[#004253]">{APP_NAME}</h1>
          <p className="mt-2 text-sm font-semibold text-[#004253]">Вход в приложении Telegram</p>
          <p className="mt-2 text-sm text-slate-600">
            Вы открыли сайт во встроенном браузере Telegram. Здесь не показываем веб-кнопку входа — она
            открывает клиент Telegram и путается с этим экраном.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <motion.a
            href={miniAppUrl}
            target="_blank"
            rel="noreferrer"
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#229ED9] bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1e8bc7]"
          >
            <Send className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Открыть {APP_NAME} в Telegram
          </motion.a>
          <p className="text-center text-[11px] leading-relaxed text-slate-500">
            Должно открыться мини-приложение бота <span className="font-mono">@{botUser}</span>. Вход
            выполняется автоматически из Telegram.
          </p>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-center text-xs font-semibold text-slate-700">Нужен вход с сайта в браузере</p>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-600">
              В меню Telegram выберите «Открыть в браузере» / «Open in browser» (или скопируйте ссылку и
              вставьте в Chrome или Safari). Там будет отдельная страница «Вход с сайта» с кнопкой для
              браузера.
            </p>
            {siteUrl ? (
              <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2 text-center font-mono text-[10px] text-slate-700">
                {siteUrl}/login
              </p>
            ) : null}
            {siteUrl ? (
              <a
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                Попробовать открыть домен во внешнем браузере
              </a>
            ) : null}
          </div>
        </div>
      </motion.div>
    </main>
  );
}
