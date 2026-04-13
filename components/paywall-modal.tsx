"use client";

import { useState } from "react";
import { activatePremiumStub } from "@/app/actions/premium";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

export function PaywallModal({
  open,
  onClose,
  onActivated,
}: {
  open: boolean;
  onClose: () => void;
  onActivated: () => void;
}) {
  const { lang } = useLanguage();
  const [phase, setPhase] = useState<"idle" | "paying" | "success">("idle");

  if (!open) return null;

  async function payMbank() {
    if (phase !== "idle") return;
    setPhase("paying");
    await new Promise((r) => setTimeout(r, 2000));
    const res = await activatePremiumStub("MBANK");
    if (res.ok) {
      setPhase("success");
      onActivated();
      setTimeout(() => {
        setPhase("idle");
        onClose();
      }, 1800);
    } else {
      setPhase("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-emerald-800/20 bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-emerald-950">{t(lang, "paywall.title")}</h3>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900/85">{t(lang, "paywall.body")}</p>

        {phase === "success" ? (
          <p className="mt-6 rounded-xl bg-emerald-900/10 px-4 py-3 text-center text-sm font-semibold text-emerald-900">
            {t(lang, "paywall.success")}
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={phase === "paying"}
              onClick={() => void payMbank()}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-800 to-emerald-900 px-4 py-3.5 text-sm font-semibold text-mint shadow-lg transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {phase === "paying" ? t(lang, "paywall.paying") : t(lang, "paywall.mbank")}
            </button>
            <button
              type="button"
              disabled={phase === "paying"}
              className="w-full rounded-2xl border border-emerald-800/25 bg-white px-4 py-2.5 text-sm text-emerald-900/80"
            >
              {t(lang, "paywall.megapay")}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            if (phase === "paying") return;
            setPhase("idle");
            onClose();
          }}
          className="mt-4 w-full rounded-xl py-2 text-sm text-emerald-800/80 hover:bg-emerald-900/5"
        >
          {t(lang, "paywall.close")}
        </button>
      </div>
    </div>
  );
}
