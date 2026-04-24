"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  HandHeart,
  Loader2,
  MapPin,
  Phone,
  Search,
  SlidersHorizontal,
  Stethoscope,
  X,
} from "lucide-react";
import Image from "next/image";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import { PhoneSelectModal } from "@/components/PhoneSelectModal";
import type { DoctorForCall, PhoneSelectEntry } from "@/lib/callDoctor";
import {
  formatPhoneDisplay,
  getTelLinkProps,
  handleDoctorCall,
  notifyTelegramCallNumber,
} from "@/lib/callDoctor";
import type { DoctorSummary } from "@/lib/doctors-kg/types";
import { decodeHtmlEntities } from "@/lib/html-entities";
import { cn } from "@/lib/utils";

type MetaCategory = { slug: string; label: string };
type MetaCity = { filterSlug: string; code: string; label: string };
type Clinic = {
  id: string;
  name: string;
  address: string;
  city: string;
  phones: string[];
  doctorCount: number;
  sampleDoctorSlug: string;
};

type MetaPayload = {
  categories: MetaCategory[];
  cities: MetaCity[];
  clinics: Clinic[];
  doctorCount: number;
  generatedAt: string | null;
  source?: string;
};

type DoctorRow = DoctorSummary & {
  telephones?: string[];
  streetAddress?: string | null;
  locality?: string | null;
  region?: string | null;
  website?: string | null;
  image?: string | null;
  priceRange?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  openingHoursLines?: string[];
};

type ListPayload = {
  doctors: DoctorRow[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
};

/**
 * merge с /api/doctors-kg/live-card: JSON присылает пустые [] / null, которые нельзя
 * класть поверх списка — иначе в модалке остаётся только имя.
 */
function mergeLiveDoctorDetail(listRow: DoctorRow, live: DoctorRow): DoctorRow {
  const out: DoctorRow = { ...listRow, ...live };
  if (!live.telephones?.length && listRow.telephones?.length) {
    out.telephones = listRow.telephones;
  }
  if (!live.categorySlugs?.length && listRow.categorySlugs?.length) {
    out.categorySlugs = listRow.categorySlugs;
  }
  if (!live.streetAddress && listRow.streetAddress) out.streetAddress = listRow.streetAddress;
  if (!live.locality && listRow.locality) out.locality = listRow.locality;
  if (!live.region && listRow.region) out.region = listRow.region;
  if (!live.description?.trim() && listRow.description?.trim()) {
    out.description = listRow.description;
  }
  if (!live.openingHoursLines?.length && listRow.openingHoursLines?.length) {
    out.openingHoursLines = listRow.openingHoursLines;
  }
  if (!live.priceRange && listRow.priceRange) out.priceRange = listRow.priceRange;
  if (live.latitude == null && listRow.latitude != null) out.latitude = listRow.latitude;
  if (live.longitude == null && listRow.longitude != null) out.longitude = listRow.longitude;
  if (!live.image && listRow.image) out.image = listRow.image;
  if (!live.website && listRow.website) out.website = listRow.website;
  if (!live.sourceUrl?.trim() && listRow.sourceUrl?.trim()) {
    out.sourceUrl = listRow.sourceUrl;
  }
  return out;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

type Props = {
  isDesktop?: boolean;
  className?: string;
  /** Предвыбор специальности из URL (?doctorCat=slug). */
  initialCategorySlug?: string | null;
};

export function DoctorDiscoveryHome({
  isDesktop = false,
  className,
  initialCategorySlug = null,
}: Props) {
  const { lang } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState<"doctors" | "clinics" | "caregivers">("doctors");
  const [meta, setMeta] = useState<MetaPayload | null>(null);
  const [metaErr, setMetaErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 380);

  const searchForRequest = useMemo(() => {
    if (mainTab === "caregivers") {
      return debouncedSearch.trim() || "сиделк";
    }
    return debouncedSearch;
  }, [mainTab, debouncedSearch]);
  const [category, setCategory] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = isDesktop ? 12 : 8;

  const [list, setList] = useState<ListPayload | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<DoctorRow | null>(null);
  const [clinicLoadErr, setClinicLoadErr] = useState<string | null>(null);
  const [phoneSelectEntries, setPhoneSelectEntries] = useState<PhoneSelectEntry[] | null>(null);
  const [callUnavailableToast, setCallUnavailableToast] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!callUnavailableToast) return;
    const id = window.setTimeout(() => setCallUnavailableToast(false), 3600);
    return () => window.clearTimeout(id);
  }, [callUnavailableToast]);

  const invokeDoctorCall = useCallback(
    (doctor: DoctorForCall) => {
      handleDoctorCall(doctor, {
        onMultiplePhones: (entries) => setPhoneSelectEntries(entries),
        onUnavailable: () => setCallUnavailableToast(true),
      });
    },
    [],
  );

  const openDoctorDetail = useCallback((d: DoctorRow) => {
    setDetail(d);
    void fetch(`/api/doctors-kg/live-card?slug=${encodeURIComponent(d.slug)}`)
      .then((r) => r.json())
      .then((j: { doctor?: DoctorRow; error?: string }) => {
        if (j.doctor) {
          const doc = j.doctor;
          setDetail((prev) => {
            if (prev?.slug !== d.slug) return prev;
            return mergeLiveDoctorDetail(prev, doc);
          });
        }
      })
      .catch(() => {});
  }, []);

  const openDoctorBySlug = useCallback(
    async (slug: string) => {
      setClinicLoadErr(null);
      try {
        const r = await fetch(`/api/doctors-kg/live-card?slug=${encodeURIComponent(slug)}`);
        const j = (await r.json()) as { doctor?: DoctorRow; error?: string };
        if (!r.ok || !j.doctor) {
          throw new Error(j.error ?? r.statusText);
        }
        setMainTab("doctors");
        setDetail(j.doctor);
      } catch {
        setClinicLoadErr(
          lang === "ru" ? "Не удалось открыть карточку врача." : "Дарыердин карточкасы ачылган жок.",
        );
      }
    },
    [lang],
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/doctors-kg/meta")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) setMetaErr(j.error);
        else setMeta(j as MetaPayload);
      })
      .catch(() => {
        if (!cancelled) setMetaErr("network");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialCategorySlug || !meta?.categories?.length) return;
    const ok = meta.categories.some((c) => c.slug === initialCategorySlug);
    if (ok) {
      setMainTab("doctors");
      setCategory(initialCategorySlug);
    }
  }, [initialCategorySlug, meta]);

  const catLabel = useMemo(() => {
    const m = new Map<string, string>();
    meta?.categories.forEach((c) => m.set(c.slug, c.label));
    return m;
  }, [meta]);

  const stripDoctorCatFromUrl = useCallback(() => {
    const q = new URLSearchParams(searchParams.toString());
    if (!q.has("doctorCat")) return;
    q.delete("doctorCat");
    const qs = q.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    router.replace(href, { scroll: false });
  }, [router, pathname, searchParams]);

  const loadDoctors = useCallback(async () => {
    if (mainTab !== "doctors" && mainTab !== "caregivers") return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setListLoading(true);
    setListErr(null);
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("perPage", String(perPage));
    if (searchForRequest.trim()) q.set("search", searchForRequest.trim());
    if (category) q.set("category", category);
    if (city) q.set("city", city);
    try {
      const res = await fetch(`/api/doctors-kg?${q}`, { signal: ac.signal });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setList(j as ListPayload);
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setListErr(e instanceof Error ? e.message : "err");
    } finally {
      setListLoading(false);
    }
  }, [mainTab, page, perPage, searchForRequest, category, city]);

  useEffect(() => {
    void loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, city, mainTab]);

  const clinicsFiltered = useMemo(() => {
    if (!meta?.clinics?.length) return [];
    const q = debouncedSearch.trim().toLowerCase();
    return meta.clinics.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.phones.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [meta, debouncedSearch]);

  const resetFilters = () => {
    setCategory(null);
    setCity(null);
    setSearch("");
    setFiltersOpen(false);
    stripDoctorCatFromUrl();
  };

  const applyLabel =
    lang === "ru" ? "Применить" : "Колдонуу";
  const resetLabel =
    lang === "ru" ? "Сбросить" : "Тазалоо";

  return (
    <div id="doctor-catalog" className={cn("space-y-4 pb-8 scroll-mt-4", className)}>
      <header className="space-y-1">
        <h1 className="font-manrope text-[1.65rem] font-bold leading-tight tracking-tight text-slate-900">
          {t(lang, "home.discovery.title")}
        </h1>
        {meta?.generatedAt ? (
          <p className="text-[11px] text-slate-500">
            {lang === "ru" ? "Данные каталога обновлены:" : "Каталог жаңыланган:"}{" "}
            {new Date(meta.generatedAt).toLocaleString(lang === "ru" ? "ru-RU" : "ky-KG")} ·{" "}
            {meta.doctorCount} {lang === "ru" ? "врачей" : "дарыер"}
          </p>
        ) : null}
      </header>

      <div
        className="mx-auto w-full max-w-md rounded-full bg-[#e3e3e5]/90 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] sm:max-w-2xl"
        role="tablist"
        aria-label={lang === "ru" ? "Каталог" : "Каталог"}
      >
        <div className="grid grid-cols-3 gap-0.5 sm:gap-0">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "doctors"}
            onClick={() => setMainTab("doctors")}
            className={cn(
              "flex min-h-[40px] items-center justify-center gap-1 rounded-full px-1.5 text-[12px] font-semibold transition-all sm:min-h-[44px] sm:px-2 sm:text-[13px]",
              mainTab === "doctors"
                ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                : "text-slate-600 hover:text-slate-800",
            )}
          >
            <Stethoscope className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="truncate">{t(lang, "home.segment.doctors")}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "clinics"}
            onClick={() => setMainTab("clinics")}
            className={cn(
              "flex min-h-[40px] items-center justify-center gap-1 rounded-full px-1.5 text-[12px] font-semibold transition-all sm:min-h-[44px] sm:px-2 sm:text-[13px]",
              mainTab === "clinics"
                ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                : "text-slate-600 hover:text-slate-800",
            )}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="truncate">{t(lang, "home.clinics.title")}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "caregivers"}
            onClick={() => {
              setMainTab("caregivers");
              setCategory(null);
              stripDoctorCatFromUrl();
            }}
            className={cn(
              "flex min-h-[40px] items-center justify-center gap-1 rounded-full px-1.5 text-[12px] font-semibold transition-all sm:min-h-[44px] sm:px-2 sm:text-[13px]",
              mainTab === "caregivers"
                ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                : "text-slate-600 hover:text-slate-800",
            )}
          >
            <HandHeart className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="truncate">{t(lang, "home.segment.caregivers")}</span>
          </button>
        </div>
      </div>

      {mainTab === "caregivers" ? (
        <p className="text-center text-[11px] text-slate-500">{t(lang, "home.caregivers.hint")}</p>
      ) : null}

      <div className="rounded-xl bg-white p-3.5 shadow-md ring-1 ring-slate-200/80 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(lang, "home.search.placeholder")}
              className="min-h-[44px] w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-11 pr-4 text-[14px] text-slate-900 shadow-inner ring-1 ring-slate-200/90 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-300"
              aria-label={t(lang, "home.search.placeholder")}
            />
            {listLoading && (mainTab === "doctors" || mainTab === "caregivers") ? (
              <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-teal-600" />
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 text-[13px] font-semibold text-teal-900 shadow-sm ring-1 ring-teal-100/80 hover:bg-teal-100/90 lg:flex-none"
            >
              <SlidersHorizontal className="h-4 w-4 text-teal-800" aria-hidden />
              {t(lang, "home.search.filters")}
            </button>
          </div>
        </div>
        {(category || city) && (mainTab === "doctors" || mainTab === "caregivers") ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {category ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-caption font-medium text-teal-900 ring-1 ring-teal-100">
                {catLabel.get(category) ?? category}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-teal-100"
                  aria-label="clear"
                  onClick={() => {
                    setCategory(null);
                    stripDoctorCatFromUrl();
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
            {city ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-caption font-medium text-slate-800 ring-1 ring-slate-200">
                {meta?.cities.find((c) => c.filterSlug === city)?.label ?? city}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-slate-200"
                  aria-label="clear"
                  onClick={() => setCity(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
            <button
              type="button"
              onClick={resetFilters}
              className="text-caption font-semibold text-health-primary underline underline-offset-2"
            >
              {resetLabel}
            </button>
          </div>
        ) : null}
      </div>

      {metaErr ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-caption text-amber-950 ring-1 ring-amber-200">
          {lang === "ru"
            ? "Не удалось загрузить справочник фильтров. Проверьте сеть."
            : "Фильтрлерди жүктөө иштебеди."}
        </p>
      ) : null}

      {mainTab === "doctors" || mainTab === "caregivers" ? (
        <>
          {listErr ? (
            <p className="text-sm text-red-700">{listErr}</p>
          ) : null}
          <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200/80">
            <AnimatePresence mode="popLayout">
              {(list?.doctors ?? []).map((d, idx) => {
                const street = d.streetAddress
                  ? decodeHtmlEntities(d.streetAddress).trim()
                  : "";
                const loc = d.locality ? decodeHtmlEntities(d.locality).trim() : "";
                const reg = d.region ? decodeHtmlEntities(d.region).trim() : "";
                const cityOnly =
                  meta?.cities.find((c) => c.code === d.cityCode)?.label ??
                  d.cityCode ??
                  "";
                const addressParts = [street, loc || reg].filter(Boolean);
                const address = addressParts.length
                  ? addressParts.join(", ")
                  : cityOnly || (lang === "ru" ? "Адрес не указан" : "Дареги жок");
                return (
                <motion.article
                  key={d.slug}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.02 }}
                  className="border-b border-slate-100 p-3 last:border-b-0 sm:p-4"
                >
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(11rem,0.75fr)_minmax(0,1.2fr)] sm:items-start">
                    <h3 className="font-manrope text-[15px] font-semibold leading-snug text-slate-900 sm:text-base">
                      {d.name}
                    </h3>
                    <div className="space-y-1">
                      {d.telephones?.length ? (
                        d.telephones.map((p) => {
                          const link = getTelLinkProps(p);
                          return link ? (
                            <a
                              key={p}
                              {...link}
                              onClick={() => notifyTelegramCallNumber(p)}
                              className="flex min-h-[34px] items-center gap-1.5 text-[13px] font-semibold text-health-primary"
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="break-words">{formatPhoneDisplay(p)}</span>
                            </a>
                          ) : (
                            <span key={p} className="block text-[13px] text-slate-600">
                              {formatPhoneDisplay(p)}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[13px] text-slate-400">
                          {lang === "ru" ? "Телефон не указан" : "Телефон жок"}
                        </span>
                      )}
                    </div>
                    <p className="flex gap-1.5 text-[13px] leading-snug text-slate-700">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <span className="break-words">{address}</span>
                    </p>
                  </div>
                </motion.article>
                );
              })}
            </AnimatePresence>
          </div>

          {list && list.total === 0 ? (
            <p className="py-8 text-center text-body text-slate-600">
              {lang === "ru" ? "Ничего не найдено — смените запрос или фильтры." : "Табылган жок."}
            </p>
          ) : null}

          {list && list.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={page <= 1 || listLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-white px-4 text-caption font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                {lang === "ru" ? "Назад" : "Артка"}
              </button>
              <span className="text-caption text-slate-600">
                {page} / {list.totalPages} · {list.total}{" "}
                {lang === "ru" ? "всего" : "бардыгы"}
              </span>
              <button
                type="button"
                disabled={page >= list.totalPages || listLoading}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-white px-4 text-caption font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 disabled:opacity-40"
              >
                {lang === "ru" ? "Далее" : "Алдыга"}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <section>
          <h2 className="font-manrope text-lg font-semibold text-slate-900 sm:text-[1.5rem]">
            {t(lang, "home.clinics.title")}
          </h2>
          <p className="mt-1 text-caption text-slate-500">
            {lang === "ru"
              ? "Адреса и телефоны — в каталоге SakBol, без перехода на сторонние сайты."
              : "Даректер SakBol каталогунда, башка сайттарга өтпөстөн."}
          </p>
          {clinicLoadErr ? (
            <p className="mt-2 text-sm text-red-700">{clinicLoadErr}</p>
          ) : null}
          <div
            className={cn(
              "mt-4 grid gap-4",
              isDesktop ? "md:grid-cols-2 xl:grid-cols-2" : "grid-cols-1",
            )}
          >
            {clinicsFiltered.map((c) => (
              <article
                key={c.id}
                className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-200/80"
              >
                <h3 className="font-manrope text-[15px] font-semibold text-slate-900">{c.name}</h3>
                <p className="mt-1 text-caption text-slate-600">
                  {c.city} · {lang === "ru" ? "врачей:" : "дарыер:"} {c.doctorCount}
                </p>
                <div className="mt-3 space-y-1">
                  {c.phones.map((p) => {
                    const link = getTelLinkProps(p);
                    return link ? (
                      <a
                        key={p}
                        {...link}
                        onClick={() => notifyTelegramCallNumber(p)}
                        className="flex min-h-[44px] w-full items-center gap-2 text-left text-caption font-semibold text-health-primary"
                      >
                        <Phone className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="break-words">{formatPhoneDisplay(p)}</span>
                      </a>
                    ) : null;
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => void openDoctorBySlug(c.sampleDoctorSlug)}
                  className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-health-primary text-caption font-semibold text-white shadow-sm hover:bg-teal-700"
                >
                  {t(lang, "home.card.more")}
                </button>
              </article>
            ))}
          </div>
          {clinicsFiltered.length === 0 ? (
            <p className="py-8 text-center text-slate-600">
              {lang === "ru" ? "Нет данных клиник — выполните npm run doctors-kg:sync" : "Маалымат жок."}
            </p>
          ) : null}
        </section>
      )}

      <AnimatePresence>
        {filtersOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-manrope text-lg font-semibold text-slate-900">
                  {t(lang, "home.search.filters")}
                </h3>
                <button
                  type="button"
                  className="rounded-full p-2 hover:bg-slate-100"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-caption text-slate-500">
                {lang === "ru"
                  ? "Город и поиск применяются к локальному каталогу в приложении."
                  : "Шаар жана издөө колдонмодогу каталогко колдонулат."}
              </p>
              <div className="mt-4">
                <p className="text-caption font-semibold text-slate-700">
                  {lang === "ru" ? "Город" : "Шаар"}
                </p>
                <div className="mt-2 flex max-h-40 flex-col gap-2 overflow-y-auto">
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 ring-1 ring-slate-200">
                    <input
                      type="radio"
                      name="city"
                      checked={city == null}
                      onChange={() => setCity(null)}
                      className="h-4 w-4 accent-teal-600"
                    />
                    <span className="text-caption">{lang === "ru" ? "Все города" : "Бардык шаар"}</span>
                  </label>
                  {(meta?.cities ?? []).map((c) => (
                    <label
                      key={c.filterSlug}
                      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 ring-1 ring-slate-200"
                    >
                      <input
                        type="radio"
                        name="city"
                        checked={city === c.filterSlug}
                        onChange={() => setCity(c.filterSlug)}
                        className="h-4 w-4 accent-teal-600"
                      />
                      <span className="text-caption">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetFilters();
                  }}
                  className="min-h-[48px] flex-1 rounded-2xl bg-slate-100 text-caption font-semibold text-slate-800"
                >
                  {resetLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="min-h-[48px] flex-1 rounded-2xl bg-health-primary text-caption font-semibold text-white shadow-sm"
                >
                  {applyLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {detail ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
            role="dialog"
            aria-modal
          >
            <motion.div
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              exit={{ y: 16 }}
              className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
            >
              <div className="flex justify-between gap-2">
                <h3 className="font-manrope text-xl font-bold leading-snug text-slate-900 break-words">
                  {detail.name}
                </h3>
                <div className="flex shrink-0 items-center gap-1">
                  {detail.telephones?.length ? (
                    (() => {
                      const tels = detail.telephones;
                      const first = tels?.[0];
                      const detailTelLink =
                        tels?.length === 1 && first ? getTelLinkProps(first) : null;
                      return detailTelLink ? (
                        <a
                          {...detailTelLink}
                          onClick={() => {
                            if (first) notifyTelegramCallNumber(first);
                          }}
                          className="rounded-full p-2 text-health-primary hover:bg-teal-50"
                          aria-label={t(lang, "home.card.call")}
                        >
                          <Phone className="h-5 w-5" aria-hidden />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => invokeDoctorCall({ telephones: detail.telephones })}
                          className="rounded-full p-2 text-health-primary hover:bg-teal-50"
                          aria-label={t(lang, "home.card.call")}
                        >
                          <Phone className="h-5 w-5" aria-hidden />
                        </button>
                      );
                    })()
                  ) : null}
                  <button
                    type="button"
                    className="rounded-full p-2 hover:bg-slate-100"
                    onClick={() => setDetail(null)}
                    aria-label={t(lang, "home.card.close")}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.categorySlugs.length ? (
                  detail.categorySlugs.map((s) => (
                    <span
                      key={s}
                      className="inline-flex max-w-full break-words rounded-full bg-teal-50 px-2.5 py-1 text-[12px] font-semibold leading-snug text-teal-900 ring-1 ring-teal-100"
                    >
                      {catLabel.get(s) ?? s}
                    </span>
                  ))
                ) : (
                  <p className="text-[12px] text-slate-500">
                    {lang === "ru" ? "Специализация в каталоге не указана" : "Адиспециалдагы көрсөтмө жок"}
                  </p>
                )}
              </div>
              {(() => {
                const street = detail.streetAddress
                  ? decodeHtmlEntities(detail.streetAddress).trim()
                  : "";
                const loc = detail.locality ? decodeHtmlEntities(detail.locality).trim() : "";
                const reg = detail.region ? decodeHtmlEntities(detail.region).trim() : "";
                if (!street && !loc && !reg) return null;
                return (
                  <div className="mt-3 flex gap-2 text-caption leading-relaxed text-slate-600">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0 space-y-1 break-words">
                      {street ? (
                        <p className="font-medium text-slate-800">
                          {street}
                          {loc ? `, ${loc}` : ""}
                        </p>
                      ) : loc ? (
                        <p className="font-medium text-slate-800">{loc}</p>
                      ) : null}
                      {reg && (street || loc) && reg.toLowerCase() !== loc.toLowerCase() ? (
                        <p className="text-slate-500">{reg}</p>
                      ) : !street && !loc && reg ? (
                        <p className="font-medium text-slate-800">{reg}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
              {detail.latitude != null && detail.longitude != null ? (
                <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-slate-200">
                  <iframe
                    title={lang === "ru" ? "Карта" : "Карта"}
                    className="h-48 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}&z=16&output=embed`}
                  />
                  <a
                    href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[44px] items-center justify-center gap-2 bg-slate-50 px-4 text-caption font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                    {lang === "ru" ? "Открыть в Google Картах" : "Google картасы"}
                  </a>
                </div>
              ) : null}
              {detail.priceRange ? (
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {lang === "ru" ? "Стоимость" : "Баасы"}
                  </p>
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-800 break-words">
                    {decodeHtmlEntities(detail.priceRange)}
                  </p>
                </div>
              ) : null}
              {detail.description?.trim() ? (
                <div className="mt-4">
                  <p className="text-caption font-semibold text-slate-800">
                    {lang === "ru" ? "О враче / услуги" : "Дарыер / кызматтар"}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-600 break-words">
                    {decodeHtmlEntities(detail.description.trim())}
                  </p>
                </div>
              ) : null}
              {detail.openingHoursLines?.length ? (
                <div className="mt-4">
                  <p className="text-caption font-semibold text-slate-800">
                    {lang === "ru" ? "Часы работы" : "Иш убактысы"}
                  </p>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-[14px] leading-snug text-slate-600 marker:text-teal-600">
                    {detail.openingHoursLines.map((line) => (
                      <li key={line} className="break-words pl-0.5">
                        {decodeHtmlEntities(line)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-4 space-y-2">
                {(detail.telephones ?? []).map((p) => {
                  const link = getTelLinkProps(p);
                  return link ? (
                    <a
                      key={p}
                      {...link}
                      onClick={() => notifyTelegramCallNumber(p)}
                      className="flex min-h-[48px] w-full items-center gap-2 rounded-xl bg-teal-50 px-4 text-left text-caption font-semibold text-teal-900 ring-1 ring-teal-100 hover:bg-teal-100"
                    >
                      <Phone className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="break-words">{formatPhoneDisplay(p)}</span>
                    </a>
                  ) : null;
                })}
              </div>
              {!detail.telephones?.length && detail.sourceUrl ? (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 ring-1 ring-amber-100">
                  <p className="text-[12px] leading-relaxed text-amber-950">
                    {lang === "ru"
                      ? "Номера нет в локальном кэше каталога. Телефон часто есть на исходной странице врача (ссылка ниже)."
                      : "Каталогдогу кэште номер жок. Аны көбүнчө баштапкы сайтта табууга болот."}
                  </p>
                  <a
                    href={detail.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-caption font-semibold text-teal-800 underline decoration-teal-600/50"
                  >
                    {lang === "ru" ? "Открыть исходную карточку" : "Баштапкы баракчаны ачуу"}
                  </a>
                </div>
              ) : null}
              {detail.website && !/doctors\.kg/i.test(detail.website) ? (
                <a
                  href={detail.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block text-caption font-semibold text-health-primary underline"
                >
                  {detail.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PhoneSelectModal
        open={Boolean(phoneSelectEntries?.length)}
        onClose={() => setPhoneSelectEntries(null)}
        entries={phoneSelectEntries ?? []}
        title={t(lang, "home.card.pickPhone")}
        cancelLabel={t(lang, "call.cancel")}
        callActionLabel={t(lang, "call.tapNumber")}
      />

      <AnimatePresence>
        {callUnavailableToast ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none fixed bottom-24 left-4 right-4 z-[90] mx-auto max-w-md rounded-2xl bg-slate-900 px-4 py-3 text-center text-caption font-medium text-white shadow-lg sm:bottom-8"
            role="status"
          >
            {t(lang, "call.unavailable")}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
