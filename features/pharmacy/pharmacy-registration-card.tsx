"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Plus } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { useTelegramSession } from "@/context/telegram-session-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Регистрация аптеки — только для профиля (B2B), не показываем на основном экране фармпоиска.
 */
export function PharmacyRegistrationCard({ className }: { className?: string }) {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated } = useTelegramSession();
  const [loading, setLoading] = useState(true);
  const [hasPharmacy, setHasPharmacy] = useState(false);

  const [regName, setRegName] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regCity, setRegCity] = useState("Бишкек");
  const [regPhone, setRegPhone] = useState("");
  const [regHours24, setRegHours24] = useState(false);
  const [regTimeFrom, setRegTimeFrom] = useState("09:00");
  const [regTimeTo, setRegTimeTo] = useState("18:00");
  const [regBusy, setRegBusy] = useState(false);

  const loadMe = useCallback(() => {
    if (!authReady || !isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetch("/api/pharmacy/me", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json()) as { pharmacy?: { id: string } | null };
        if (!r.ok) throw new Error();
        setHasPharmacy(Boolean(j.pharmacy?.id));
      })
      .catch(() => setHasPharmacy(false))
      .finally(() => setLoading(false));
  }, [authReady, isAuthenticated]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  if (!authReady || !isAuthenticated || loading) {
    return null;
  }
  if (hasPharmacy) {
    return null;
  }

  return (
    <div className={cn("rounded-2xl border border-amber-200/90 bg-amber-50/80 p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
          <Building2 className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950">{t(lang, "pharmacy.registerPharmacy")}</p>
          <p className="mt-1 text-[11px] leading-snug text-amber-900/85">{t(lang, "profile.b2bPharmacyLead")}</p>
        </div>
      </div>
      <input
        value={regName}
        onChange={(e) => setRegName(e.target.value)}
        placeholder={t(lang, "pharmacy.phName")}
        className="mt-3 w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2.5 text-sm shadow-sm"
      />
      <input
        value={regAddress}
        onChange={(e) => setRegAddress(e.target.value)}
        placeholder={t(lang, "pharmacy.phAddress")}
        className="mt-2 w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2.5 text-sm shadow-sm"
      />
      <input
        value={regCity}
        onChange={(e) => setRegCity(e.target.value)}
        placeholder={t(lang, "pharmacy.phCity")}
        className="mt-2 w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2.5 text-sm shadow-sm"
      />
      <input
        value={regPhone}
        onChange={(e) => setRegPhone(e.target.value)}
        placeholder={t(lang, "pharmacy.phPhone")}
        className="mt-2 w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2.5 text-sm shadow-sm"
      />
      <p className="mt-3 text-[11px] font-semibold text-amber-950">{t(lang, "pharmacy.hoursSection")}</p>
      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200/60 bg-white/90 px-3 py-2.5 text-sm font-medium text-amber-950">
        <input
          type="checkbox"
          checked={regHours24}
          onChange={(e) => setRegHours24(e.target.checked)}
          className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
        />
        {t(lang, "pharmacy.hours247")}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-initial">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/70">
            {t(lang, "pharmacy.hoursFrom")}
          </span>
          <input
            type="time"
            value={regTimeFrom}
            disabled={regHours24}
            onChange={(e) => setRegTimeFrom(e.target.value)}
            className="w-full min-w-[7.5rem] rounded-xl border border-amber-200/80 bg-white px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          />
        </div>
        <span className="hidden pt-5 text-amber-800 sm:inline" aria-hidden>
          —
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-initial">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/70">
            {t(lang, "pharmacy.hoursTo")}
          </span>
          <input
            type="time"
            value={regTimeTo}
            disabled={regHours24}
            onChange={(e) => setRegTimeTo(e.target.value)}
            className="w-full min-w-[7.5rem] rounded-xl border border-amber-200/80 bg-white px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          />
        </div>
      </div>
      <button
        type="button"
        disabled={regBusy}
        onClick={() => {
          setRegBusy(true);
          const phones = regPhone
            .split(/[,;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const workHours = regHours24 ? "24/7" : `${regTimeFrom}–${regTimeTo}`;
          void fetch("/api/pharmacy/register", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: regName.trim(),
              address: regAddress.trim(),
              city: regCity.trim() || "Бишкек",
              phones,
              workHours,
            }),
          })
            .then(async (r) => {
              const j = (await r.json().catch(() => ({}))) as { error?: string };
              if (!r.ok) {
                window.alert(j.error ?? "Ошибка");
                return;
              }
              setHasPharmacy(true);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("sakbol:session-updated"));
              }
            })
            .finally(() => setRegBusy(false));
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-3 text-sm font-bold text-white shadow-md shadow-amber-900/25 disabled:opacity-50"
      >
        {regBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
        {regBusy ? "…" : t(lang, "pharmacy.registerFree")}
      </button>
    </div>
  );
}
