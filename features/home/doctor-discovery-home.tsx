"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
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
import type { DoctorSummary } from "@/lib/doctors-kg/types";
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
  website?: string | null;
  image?: string | null;
  priceRange?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ListPayload = {
  doctors: DoctorRow[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

type Props = { isDesktop?: boolean; className?: string };

export function DoctorDiscoveryHome({ isDesktop = false, className }: Props) {
  const { lang } = useLanguage();
  const [mainTab, setMainTab] = useState<"doctors" | "clinics">("doctors");
  const [meta, setMeta] = useState<MetaPayload | null>(null);
  const [metaErr, setMetaErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 380);
  const [category, setCategory] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = isDesktop ? 12 : 8;

  const [list, setList] = useState<ListPayload | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<DoctorRow | null>(null);

  const abortRef = useRef<AbortController | null>(null);

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

  const catLabel = useMemo(() => {
    const m = new Map<string, string>();
    meta?.categories.forEach((c) => m.set(c.slug, c.label));
    return m;
  }, [meta]);

  const loadDoctors = useCallback(async () => {
    if (mainTab !== "doctors") return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setListLoading(true);
    setListErr(null);
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("perPage", String(perPage));
    if (debouncedSearch.trim()) q.set("search", debouncedSearch.trim());
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
  }, [mainTab, page, perPage, debouncedSearch, category, city]);

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
  };

  const applyLabel =
    lang === "ru" ? "Применить" : "Колдонуу";
  const resetLabel =
    lang === "ru" ? "Сбросить" : "Тазалоо";

  return (
    <div className={cn("space-y-6 pb-8", className)}>
      <header className="space-y-2">
        <h1 className="font-manrope text-[2rem] font-bold leading-tight tracking-tight text-slate-900">
          {t(lang, "home.discovery.title")}
        </h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-slate-600">
          {t(lang, "home.discovery.lead")}
        </p>
        {meta?.generatedAt ? (
          <p className="text-caption text-slate-500">
            {lang === "ru" ? "Данные каталога обновлены:" : "Каталог жаңыланган:"}{" "}
            {new Date(meta.generatedAt).toLocaleString(lang === "ru" ? "ru-RU" : "ky-KG")} ·{" "}
            {meta.doctorCount} {lang === "ru" ? "врачей" : "дарыер"}
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200/90 sm:inline-flex">
        <button
          type="button"
          onClick={() => setMainTab("doctors")}
          className={cn(
            "flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-caption font-semibold transition-all sm:flex-none",
            mainTab === "doctors"
              ? "bg-teal-50 text-health-primary shadow-sm ring-1 ring-teal-100"
              : "text-slate-600 hover:bg-slate-50",
          )}
        >
          <Stethoscope className="h-4 w-4 shrink-0" aria-hidden />
          {lang === "ru" ? "Врачи" : "Дарыерлер"}
        </button>
        <button
          type="button"
          onClick={() => setMainTab("clinics")}
          className={cn(
            "flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-caption font-semibold transition-all sm:flex-none",
            mainTab === "clinics"
              ? "bg-teal-50 text-health-primary shadow-sm ring-1 ring-teal-100"
              : "text-slate-600 hover:bg-slate-50",
          )}
        >
          <Building2 className="h-4 w-4 shrink-0" aria-hidden />
          {t(lang, "home.clinics.title")}
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-200/80 sm:p-5">
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
              className="min-h-[52px] w-full rounded-2xl border-0 bg-slate-50 py-3 pl-12 pr-4 text-[15px] text-slate-900 shadow-inner ring-1 ring-slate-200/90 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-300"
              aria-label={t(lang, "home.search.placeholder")}
            />
            {listLoading ? (
              <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-teal-600" />
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-[15px] font-semibold text-white shadow-sm hover:bg-slate-800 lg:flex-none"
            >
              <SlidersHorizontal className="h-5 w-5" aria-hidden />
              {t(lang, "home.search.filters")}
            </button>
          </div>
        </div>
        {(category || city) && mainTab === "doctors" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {category ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-caption font-medium text-teal-900 ring-1 ring-teal-100">
                {catLabel.get(category) ?? category}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-teal-100"
                  aria-label="clear"
                  onClick={() => setCategory(null)}
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

      {mainTab === "doctors" && meta?.categories?.length ? (
        <section>
          <h2 className="font-manrope text-lg font-semibold text-slate-900 sm:text-[1.5rem]">
            {t(lang, "home.categories.title")}
          </h2>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2.5 text-caption font-semibold shadow-sm ring-1 transition-colors",
                !category
                  ? "bg-health-primary text-white ring-health-primary"
                  : "bg-white text-slate-800 ring-slate-200 hover:bg-teal-50",
              )}
            >
              {lang === "ru" ? "Все" : "Баары"}
            </button>
            {meta.categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setCategory((prev) => (prev === c.slug ? null : c.slug))}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2.5 text-caption font-semibold shadow-sm ring-1 transition-colors",
                  category === c.slug
                    ? "bg-health-primary text-white ring-health-primary"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-teal-50",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {mainTab === "doctors" ? (
        <>
          {listErr ? (
            <p className="text-sm text-red-700">{listErr}</p>
          ) : null}
          <div
            className={cn(
              "grid gap-4",
              isDesktop ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1",
            )}
          >
            <AnimatePresence mode="popLayout">
              {(list?.doctors ?? []).map((d, idx) => (
                <motion.article
                  key={d.slug}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.02 }}
                  className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200/80"
                >
                  <div className="flex gap-3 p-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                      {d.image ? (
                        <Image
                          src={d.image}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">
                          {d.name
                            .split(/\s+/)
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 3)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-manrope text-[15px] font-semibold leading-snug text-slate-900">
                        {d.name}
                      </h3>
                      <p className="mt-0.5 text-caption text-teal-800">
                        {d.categorySlugs.map((s) => catLabel.get(s) ?? s).join(" · ")}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-caption text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {d.locality ??
                          meta?.cities.find((c) => c.code === d.cityCode)?.label ??
                          (d.cityCode ?? "—")}
                      </p>
                      {d.telephones?.length ? (
                        <a
                          href={`tel:${d.telephones[0].replace(/\s/g, "")}`}
                          className="mt-1 inline-flex items-center gap-1 text-caption font-semibold text-health-primary"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          {d.telephones[0]}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-auto flex gap-2 border-t border-slate-100 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDetail(d)}
                      className="min-h-[44px] flex-1 rounded-xl bg-health-primary py-2.5 text-caption font-semibold text-white shadow-sm hover:bg-teal-700"
                    >
                      {t(lang, "home.card.more")}
                    </button>
                    <a
                      href={d.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-white py-2.5 text-caption font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      doctors.kg
                    </a>
                  </div>
                </motion.article>
              ))}
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
              ? "Адреса и телефоны собраны из открытых карточек врачей на doctors.kg."
              : "Даректер doctors.kg ачык карточкаларынан алынган."}
          </p>
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
                  {c.phones.map((p) => (
                    <a
                      key={p}
                      href={`tel:${p.replace(/\s/g, "")}`}
                      className="flex items-center gap-2 text-caption font-semibold text-health-primary"
                    >
                      <Phone className="h-4 w-4 shrink-0" aria-hidden />
                      {p}
                    </a>
                  ))}
                </div>
                <a
                  href={`https://doctors.kg/directory-doctors/listing/${c.sampleDoctorSlug}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-white text-caption font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  {t(lang, "home.card.open")}
                </a>
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
                  ? "Фильтры запрашивают doctors.kg напрямую (как официальный каталог)."
                  : "Фильтрлер doctors.kg менен шайкеш."}
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
                <h3 className="font-manrope text-xl font-bold text-slate-900">{detail.name}</h3>
                <button
                  type="button"
                  className="shrink-0 rounded-full p-2 hover:bg-slate-100"
                  onClick={() => setDetail(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-body text-teal-800">
                {detail.categorySlugs.map((s) => catLabel.get(s) ?? s).join(" · ")}
              </p>
              {detail.streetAddress ? (
                <p className="mt-3 flex gap-2 text-caption text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {detail.streetAddress}
                  {detail.locality ? `, ${detail.locality}` : ""}
                </p>
              ) : null}
              {detail.priceRange ? (
                <p className="mt-2 text-caption text-slate-600">{detail.priceRange}</p>
              ) : null}
              {detail.latitude != null && detail.longitude != null ? (
                <a
                  href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-50 px-4 text-caption font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
                >
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {lang === "ru" ? "Открыть на карте" : "Картада ачуу"}
                </a>
              ) : null}
              <div className="mt-4 space-y-2">
                {(detail.telephones ?? []).map((p) => (
                  <a
                    key={p}
                    href={`tel:${p.replace(/\s/g, "")}`}
                    className="flex min-h-[48px] items-center gap-2 rounded-xl bg-teal-50 px-4 text-caption font-semibold text-teal-900 ring-1 ring-teal-100"
                  >
                    <Phone className="h-4 w-4 shrink-0" aria-hidden />
                    {p}
                  </a>
                ))}
              </div>
              {detail.website ? (
                <a
                  href={detail.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block text-caption font-semibold text-health-primary underline"
                >
                  {detail.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
              <a
                href={detail.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-slate-900 text-caption font-semibold text-white"
              >
                doctors.kg — {lang === "ru" ? "полная карточка" : "толук карточка"}
              </a>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
