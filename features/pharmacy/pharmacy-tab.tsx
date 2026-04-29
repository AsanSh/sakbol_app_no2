"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Loader2, MapPin, Phone, Pill, Plus, UserRound } from "lucide-react";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useLanguage } from "@/context/language-context";
import { useTelegramSession } from "@/context/telegram-session-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatPhoneDisplay, getTelLinkProps } from "@/lib/callDoctor";

type PharmacyMe = {
  id: string;
  name: string;
  address: string;
  city: string;
  phones: string[];
  workHours: string | null;
  telegramNotifyChatId: string | null;
  stats?: { responsesWeek: number; openRequestsApprox: number };
};

type OpenRequest = {
  id: string;
  medicineName: string;
  note: string | null;
  createdAt: string;
  alreadyResponded: boolean;
};

type RequestRow = {
  id: string;
  medicineName: string;
  note: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  responses: Array<{
    id: string;
    inStock: boolean;
    price: number | null;
    priceUnit: string | null;
    note: string | null;
    pharmacy: {
      id: string;
      name: string;
      address: string;
      city: string;
      phones: string[];
      workHours: string | null;
      latitude: number | null;
      longitude: number | null;
    };
  }>;
};

export function PharmacyTab() {
  const { lang } = useLanguage();
  const { authReady, isAuthenticated } = useTelegramSession();
  const [meLoading, setMeLoading] = useState(true);
  const [pharmacy, setPharmacy] = useState<PharmacyMe | null>(null);
  const [openReqs, setOpenReqs] = useState<OpenRequest[]>([]);
  const [userReqs, setUserReqs] = useState<RequestRow[]>([]);
  const [segment, setSegment] = useState<"search" | "mine">("search");
  /** Один аккаунт: и пациент (фармпоиск для себя), и владелец аптеки — не смешиваем экраны. */
  const [ownerView, setOwnerView] = useState<"patient" | "pharmacy">("patient");

  const [medName, setMedName] = useState("");
  const [medNote, setMedNote] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);

  const [regName, setRegName] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regCity, setRegCity] = useState("Бишкек");
  const [regPhone, setRegPhone] = useState("");
  const [regHours, setRegHours] = useState("");
  const [regBusy, setRegBusy] = useState(false);

  const [respondFor, setRespondFor] = useState<OpenRequest | null>(null);
  const [rInStock, setRInStock] = useState(true);
  const [rPrice, setRPrice] = useState("");
  const [rNote, setRNote] = useState("");
  const [rBusy, setRBusy] = useState(false);

  const loadMe = useCallback(() => {
    if (!authReady || !isAuthenticated) {
      setMeLoading(false);
      return;
    }
    setMeLoading(true);
    void fetch("/api/pharmacy/me", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json()) as { pharmacy?: PharmacyMe | null };
        if (!r.ok) throw new Error();
        setPharmacy(j.pharmacy ?? null);
      })
      .catch(() => setPharmacy(null))
      .finally(() => setMeLoading(false));
  }, [authReady, isAuthenticated]);

  const loadOpenRequests = useCallback(() => {
    if (!pharmacy) return;
    void fetch("/api/pharmacy/open-requests", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json()) as { requests?: OpenRequest[] };
        if (r.ok) setOpenReqs(j.requests ?? []);
      })
      .catch(() => {});
  }, [pharmacy]);

  const loadUserRequests = useCallback(() => {
    if (!authReady || !isAuthenticated) return;
    void fetch("/api/medicine/request", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json()) as { requests?: RequestRow[] };
        if (r.ok) setUserReqs(j.requests ?? []);
      })
      .catch(() => {});
  }, [authReady, isAuthenticated]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    loadUserRequests();
  }, [loadUserRequests]);

  useEffect(() => {
    loadOpenRequests();
  }, [loadOpenRequests]);

  useEffect(() => {
    if (typeof window === "undefined" || !pharmacy) return;
    const raw = window.localStorage.getItem("sakbol-pharmacy-owner-view");
    if (raw === "pharmacy" || raw === "patient") setOwnerView(raw);
  }, [pharmacy]);

  const persistOwnerView = (v: "patient" | "pharmacy") => {
    setOwnerView(v);
    try {
      window.localStorage.setItem("sakbol-pharmacy-owner-view", v);
    } catch {
      /* ignore */
    }
  };

  const mapsLink = (p: RequestRow["responses"][0]["pharmacy"]) => {
    if (p.latitude != null && p.longitude != null) {
      return `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
    }
    return `https://www.google.com/maps/search/${encodeURIComponent(`${p.address}, ${p.city}`)}`;
  };

  if (!authReady) {
    return (
      <div className="w-full px-4 py-6">
        <p className="text-sm text-health-text-secondary">{t(lang, "analyses.loading")}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full px-4 py-6">
        <p className="text-sm text-amber-900">{t(lang, "dashboard.authTitle")}</p>
        <p className="mt-2 text-caption text-health-text-secondary">{t(lang, "dashboard.authBody")}</p>
      </div>
    );
  }

  if (meLoading) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-2 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-health-primary" aria-hidden />
      </div>
    );
  }

  if (pharmacy && ownerView === "pharmacy") {
    return (
      <div className="w-full">
        <SakbolTopBar title={t(lang, "pharmacy.cabinetTitle")} />
        <div className="mx-auto max-w-2xl space-y-3 px-4 pb-8 pt-2">
          <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => persistOwnerView("patient")}
              className={cn(
                "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold sm:text-caption",
                "text-slate-600",
              )}
            >
              <UserRound className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              {t(lang, "pharmacy.dualModePatient")}
            </button>
            <button
              type="button"
              onClick={() => persistOwnerView("pharmacy")}
              className={cn(
                "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold sm:text-caption",
                "bg-white text-health-primary shadow-sm",
              )}
            >
              <Building2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              {t(lang, "pharmacy.dualModeBusiness")}
            </button>
          </div>
          <p className="text-[11px] leading-snug text-health-text-secondary">{t(lang, "pharmacy.dualModeHint")}</p>
          <p className="rounded-xl bg-teal-50/90 px-3 py-2 text-caption text-teal-950 ring-1 ring-teal-100">
            <strong>{pharmacy.name}</strong>
            {pharmacy.telegramNotifyChatId ? (
              <span className="block mt-1 text-[11px] opacity-90">✓ {t(lang, "pharmacy.notifyOn")}</span>
            ) : (
              <span className="block mt-1 text-[11px] opacity-90">
                {t(lang, "pharmacy.notifyHint")}
              </span>
            )}
          </p>

          <div className="space-y-2">
            <p className="text-sm font-bold text-health-text">{t(lang, "pharmacy.openRequests")}</p>
            {openReqs.length === 0 ? (
              <p className="text-caption text-health-text-secondary">{t(lang, "pharmacy.noOpen")}</p>
            ) : (
              <ul className="space-y-2">
                {openReqs.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-health-border bg-health-surface p-3 shadow-sm"
                  >
                    <p className="font-semibold text-health-text">«{r.medicineName}»</p>
                    {r.note ? <p className="mt-1 text-caption text-health-text-secondary">{r.note}</p> : null}
                    <p className="mt-1 text-[10px] text-slate-500">
                      {new Date(r.createdAt).toLocaleString(lang === "ru" ? "ru-RU" : "ky-KG")}
                    </p>
                    {r.alreadyResponded ? (
                      <p className="mt-2 text-xs font-medium text-emerald-700">{t(lang, "pharmacy.alreadySent")}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRespondFor(r);
                          setRInStock(true);
                          setRPrice("");
                          setRNote("");
                        }}
                        className="mt-2 w-full rounded-xl bg-health-primary py-2 text-caption font-semibold text-white"
                      >
                        {t(lang, "pharmacy.respond")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {respondFor ? (
          <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/45 p-4 sm:items-center"
            role="dialog"
            aria-modal
          >
            <button type="button" className="absolute inset-0" aria-label="close" onClick={() => setRespondFor(null)} />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
              <p className="font-bold text-health-text">«{respondFor.medicineName}»</p>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={rInStock} onChange={(e) => setRInStock(e.target.checked)} />
                {t(lang, "pharmacy.inStock")}
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder={t(lang, "pharmacy.price")}
                value={rPrice}
                onChange={(e) => setRPrice(e.target.value)}
                className="mt-2 w-full rounded-xl border border-health-border px-3 py-2 text-sm"
              />
              <textarea
                placeholder={t(lang, "pharmacy.responseNote")}
                value={rNote}
                onChange={(e) => setRNote(e.target.value)}
                rows={2}
                className="mt-2 w-full rounded-xl border border-health-border px-3 py-2 text-sm"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-health-border py-2 text-caption font-semibold"
                  onClick={() => setRespondFor(null)}
                >
                  {t(lang, "paywall.close")}
                </button>
                <button
                  type="button"
                  disabled={rBusy}
                  className="flex-1 rounded-xl bg-health-primary py-2 text-caption font-semibold text-white disabled:opacity-50"
                  onClick={() => {
                    if (!respondFor) return;
                    setRBusy(true);
                    const priceNum = rPrice.trim() ? Number(rPrice.replace(",", ".")) : null;
                    void fetch(`/api/pharmacy/respond/${respondFor.id}`, {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        inStock: rInStock,
                        price: priceNum != null && Number.isFinite(priceNum) ? priceNum : null,
                        note: rNote.trim() || null,
                      }),
                    })
                      .then(async (r) => {
                        const j = (await r.json().catch(() => ({}))) as { error?: string };
                        if (!r.ok) {
                          window.alert(j.error ?? "Ошибка");
                          return;
                        }
                        setRespondFor(null);
                        loadOpenRequests();
                      })
                      .finally(() => setRBusy(false));
                  }}
                >
                  {rBusy ? "…" : t(lang, "pharmacy.send")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full">
      <SakbolTopBar title={t(lang, "pharmacy.tabTitle")} />
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-8 pt-2">
        {pharmacy ? (
          <>
            <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => persistOwnerView("patient")}
                className={cn(
                  "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold sm:text-caption",
                  "bg-white text-health-primary shadow-sm",
                )}
              >
                <UserRound className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                {t(lang, "pharmacy.dualModePatient")}
              </button>
              <button
                type="button"
                onClick={() => persistOwnerView("pharmacy")}
                className={cn(
                  "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold sm:text-caption",
                  "text-slate-600",
                )}
              >
                <Building2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                {t(lang, "pharmacy.dualModeBusiness")}
              </button>
            </div>
            <p className="text-[11px] leading-snug text-health-text-secondary">{t(lang, "pharmacy.dualModeHint")}</p>
          </>
        ) : null}
        <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSegment("search")}
            className={cn(
              "flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-xl text-[11px] font-bold sm:text-caption",
              segment === "search" ? "bg-white shadow-sm text-health-primary" : "text-slate-600",
            )}
          >
            <Pill className="h-4 w-4" />
            {t(lang, "pharmacy.segmentSearch")}
          </button>
          <button
            type="button"
            onClick={() => setSegment("mine")}
            className={cn(
              "flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-xl text-[11px] font-bold sm:text-caption",
              segment === "mine" ? "bg-white shadow-sm text-health-primary" : "text-slate-600",
            )}
          >
            {t(lang, "pharmacy.segmentMine")}
          </button>
        </div>

        {segment === "search" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <p className="text-caption text-health-text-secondary">{t(lang, "pharmacy.searchLead")}</p>
            <input
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
              placeholder={t(lang, "pharmacy.medName")}
              className="w-full rounded-xl border border-health-border bg-white px-3 py-3 text-sm"
            />
            <textarea
              value={medNote}
              onChange={(e) => setMedNote(e.target.value)}
              placeholder={t(lang, "pharmacy.medNote")}
              rows={2}
              className="w-full rounded-xl border border-health-border bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={submitBusy}
              onClick={() => {
                setSubmitBusy(true);
                void fetch("/api/medicine/request", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    medicineName: medName.trim(),
                    note: medNote.trim() || null,
                  }),
                })
                  .then(async (r) => {
                    const j = (await r.json().catch(() => ({}))) as { error?: string };
                    if (!r.ok) {
                      window.alert(j.error ?? "Ошибка");
                      return;
                    }
                    setMedName("");
                    setMedNote("");
                    setSegment("mine");
                    loadUserRequests();
                    window.alert(t(lang, "pharmacy.requestSent"));
                  })
                  .finally(() => setSubmitBusy(false));
              }}
              className="w-full rounded-xl bg-health-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitBusy ? "…" : t(lang, "pharmacy.sendRequest")}
            </button>

            {!pharmacy ? (
              <div className="rounded-2xl border border-dashed border-health-border bg-slate-50/80 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-health-text">
                  <Plus className="h-4 w-4" />
                  {t(lang, "pharmacy.registerPharmacy")}
                </p>
                <input
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder={t(lang, "pharmacy.phName")}
                  className="mt-2 w-full rounded-xl border border-health-border px-3 py-2 text-sm"
                />
                <input
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder={t(lang, "pharmacy.phAddress")}
                  className="mt-2 w-full rounded-xl border border-health-border px-3 py-2 text-sm"
                />
                <input
                  value={regCity}
                  onChange={(e) => setRegCity(e.target.value)}
                  placeholder={t(lang, "pharmacy.phCity")}
                  className="mt-2 w-full rounded-xl border border-health-border px-3 py-2 text-sm"
                />
                <input
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder={t(lang, "pharmacy.phPhone")}
                  className="mt-2 w-full rounded-xl border border-health-border px-3 py-2 text-sm"
                />
                <input
                  value={regHours}
                  onChange={(e) => setRegHours(e.target.value)}
                  placeholder={t(lang, "pharmacy.phHours")}
                  className="mt-2 w-full rounded-xl border border-health-border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={regBusy}
                  onClick={() => {
                    setRegBusy(true);
                    const phones = regPhone
                      .split(/[,;]+/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    void fetch("/api/pharmacy/register", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: regName.trim(),
                        address: regAddress.trim(),
                        city: regCity.trim() || "Бишкек",
                        phones,
                        workHours: regHours.trim() || null,
                      }),
                    })
                      .then(async (r) => {
                        const j = (await r.json().catch(() => ({}))) as { error?: string };
                        if (!r.ok) {
                          window.alert(j.error ?? "Ошибка");
                          return;
                        }
                        loadMe();
                      })
                      .finally(() => setRegBusy(false));
                  }}
                  className="mt-3 w-full rounded-xl bg-slate-800 py-2.5 text-caption font-semibold text-white disabled:opacity-50"
                >
                  {regBusy ? "…" : t(lang, "pharmacy.registerFree")}
                </button>
              </div>
            ) : null}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {userReqs.length === 0 ? (
              <p className="text-caption text-health-text-secondary">{t(lang, "pharmacy.noMine")}</p>
            ) : (
              userReqs.map((req) => (
                <div key={req.id} className="rounded-2xl border border-health-border bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-health-text">«{req.medicineName}»</p>
                      <p className="text-[10px] text-slate-500">
                        {t(lang, "pharmacy.status")}:{" "}
                        {req.status === "OPEN"
                          ? t(lang, "pharmacy.statusOpen")
                          : req.status === "CLOSED"
                            ? t(lang, "pharmacy.statusClosed")
                            : t(lang, "pharmacy.statusExpired")}
                      </p>
                    </div>
                    {req.status === "OPEN" ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(t(lang, "pharmacy.closeConfirm"))) return;
                          void fetch(`/api/medicine/request/${req.id}/close`, {
                            method: "POST",
                            credentials: "include",
                          }).then(() => loadUserRequests());
                        }}
                        className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700"
                      >
                        {t(lang, "pharmacy.closeRequest")}
                      </button>
                    ) : null}
                  </div>
                  {req.note ? <p className="mt-1 text-caption text-health-text-secondary">{req.note}</p> : null}
                  <div className="mt-3 space-y-2">
                    {req.responses.length === 0 ? (
                      <p className="text-[11px] text-slate-500">{t(lang, "pharmacy.noResponses")}</p>
                    ) : (
                      req.responses.map((resp) => {
                        const p = resp.pharmacy;
                        const tel = p.phones[0] ? getTelLinkProps(p.phones[0]) : null;
                        return (
                          <div
                            key={resp.id}
                            className="rounded-xl bg-emerald-50/80 px-3 py-2 ring-1 ring-emerald-100"
                          >
                            <p className="text-sm font-bold text-emerald-950">{p.name}</p>
                            <p className="mt-1 flex items-start gap-1 text-caption text-emerald-900">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {p.address}, {p.city}
                            </p>
                            {p.workHours ? (
                              <p className="text-[11px] text-emerald-800">{p.workHours}</p>
                            ) : null}
                            <p className="mt-1 text-caption">
                              {resp.inStock ? "✅ " : "❌ "}
                              {resp.price != null ? `${resp.price} ${resp.priceUnit ?? ""}`.trim() : ""}
                            </p>
                            {resp.note ? <p className="text-[11px] text-emerald-900">{resp.note}</p> : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <a
                                href={mapsLink(p)}
                                target="_top"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-200"
                              >
                                <MapPin className="h-3 w-3" />
                                {t(lang, "pharmacy.onMap")}
                              </a>
                              {tel ? (
                                <a
                                  {...tel}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white"
                                >
                                  <Phone className="h-3 w-3" />
                                  {formatPhoneDisplay(p.phones[0])}
                                </a>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
