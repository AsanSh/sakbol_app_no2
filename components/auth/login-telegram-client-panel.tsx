"use client";

import { motion } from "framer-motion";
import { ExternalLink, Send } from "lucide-react";
import { WebOtpLoginForm } from "@/components/auth/web-otp-login-form";
import { APP_NAME } from "@/constants";

type Props = {
  botUser: string;
  miniAppUrl: string;
};

/**
 * Вкладка /login, открытая внутри клиента Telegram.
 *
 * Раньше здесь показывалось только предложение открыть мини-апп бота, но
 * это оставляло пользователя без возможности войти по email/паролю и по
 * коду из Telegram. Теперь:
 * - основной блок — полноценная форма входа (Email + Telegram OTP),
 * - вторичная карточка — ссылка на нативный мини-апп бота для тех, кто
 *   хочет быстрый вход без ввода данных.
 */
export function LoginTelegramClientPanel({ botUser, miniAppUrl }: Props) {
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-slate-100 via-white to-slate-100">
      {/* Обычная форма входа (выбор метода + email/OTP) */}
      <WebOtpLoginForm />

      {/* Дополнительно — ссылка на нативный мини-апп */}
      <div className="mx-auto w-full max-w-sm px-5 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur"
        >
          <p className="text-center text-xs font-semibold text-slate-700">
            Или откройте нативное приложение
          </p>
          <p className="mt-1 text-center text-[11px] leading-relaxed text-slate-500">
            Мини-приложение бота <span className="font-mono">@{botUser}</span> входит автоматически —
            без ввода email и кода.
          </p>

          <motion.a
            href={miniAppUrl}
            target="_blank"
            rel="noreferrer"
            whileTap={{ scale: 0.98 }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#229ED9] bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1e8bc7]"
          >
            <Send className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Открыть {APP_NAME} в Telegram
          </motion.a>

          {siteUrl ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-center text-[11px] leading-relaxed text-slate-500">
                Можно также открыть сайт в Chrome / Safari — меню Telegram → «Открыть в браузере».
              </p>
              <a
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Открыть во внешнем браузере
              </a>
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
