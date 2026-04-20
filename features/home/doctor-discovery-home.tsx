"use client";

import { motion } from "framer-motion";
import { MapPin, Search, SlidersHorizontal, Star } from "lucide-react";
import {
  SEED_CLINICS,
  SEED_DOCTORS,
  SEED_SPECIALTY_CHIPS,
  type SeedClinic,
  type SeedDoctor,
} from "@/data/doctors-directory-seed";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function DoctorCard({ doctor, className }: { doctor: SeedDoctor; className?: string }) {
  const { lang } = useLanguage();
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col rounded-2xl bg-white p-4 shadow-md shadow-slate-900/[0.06] ring-1 ring-slate-200/80",
        className,
      )}
    >
      <div className="flex gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-sm font-bold text-health-primary ring-1 ring-teal-100"
          aria-hidden
        >
          {doctor.photoHint}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-manrope text-[15px] font-semibold leading-snug text-slate-900">{doctor.fullName}</h3>
          <p className="mt-0.5 text-caption text-teal-800">{doctor.specialty}</p>
          <p className="mt-1 text-caption text-slate-500">
            {doctor.clinic} · {doctor.city}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-amber-600" aria-hidden>
          <Star className="h-4 w-4 fill-amber-400 text-amber-500" strokeWidth={0} />
          <span className="text-caption font-semibold text-slate-700">{t(lang, "home.rating.placeholder")}</span>
        </div>
        <button
          type="button"
          className="min-h-[44px] rounded-xl bg-health-primary px-4 text-caption font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
        >
          {t(lang, "home.card.more")}
        </button>
      </div>
    </motion.article>
  );
}

function ClinicCard({ clinic, className }: { clinic: SeedClinic; className?: string }) {
  const { lang } = useLanguage();
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col rounded-2xl bg-white p-4 shadow-md shadow-slate-900/[0.06] ring-1 ring-slate-200/80",
        className,
      )}
    >
      <div className="flex gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-caption font-bold text-slate-600"
          aria-hidden
        >
          {clinic.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-manrope text-[15px] font-semibold text-slate-900">{clinic.name}</h3>
          <p className="mt-1 flex items-start gap-1 text-caption text-slate-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {clinic.address}, {clinic.city}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {clinic.specialties.map((s) => (
          <span
            key={s}
            className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200/80"
          >
            {s}
          </span>
        ))}
      </div>
      <button
        type="button"
        className="mt-4 min-h-[44px] w-full rounded-xl bg-white text-caption font-semibold text-health-primary shadow-sm ring-1 ring-teal-200 transition-colors hover:bg-teal-50/80"
      >
        {t(lang, "home.card.open")}
      </button>
    </motion.article>
  );
}

type Props = {
  /** Десктоп: более широкая сетка */
  isDesktop?: boolean;
  className?: string;
};

export function DoctorDiscoveryHome({ isDesktop = false, className }: Props) {
  const { lang } = useLanguage();

  return (
    <div className={cn("space-y-8", className)}>
      <header className="space-y-2">
        <h1 className="font-manrope text-[2rem] font-bold leading-tight tracking-tight text-slate-900">
          {t(lang, "home.discovery.title")}
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-slate-600">{t(lang, "home.discovery.lead")}</p>
      </header>

      <div className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-200/80 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              readOnly
              placeholder={t(lang, "home.search.placeholder")}
              className="min-h-[52px] w-full cursor-default rounded-2xl border-0 bg-slate-50 py-3 pl-12 pr-4 text-[15px] text-slate-900 shadow-inner ring-1 ring-slate-200/90 placeholder:text-slate-400"
              aria-label={t(lang, "home.search.placeholder")}
            />
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <button
              type="button"
              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-health-primary px-5 text-[15px] font-semibold text-white shadow-sm hover:bg-teal-700 sm:flex-none"
            >
              <Search className="h-4 w-4" aria-hidden />
              {t(lang, "home.search.find")}
            </button>
            <button
              type="button"
              className="inline-flex min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl bg-white text-health-primary shadow-sm ring-1 ring-slate-200 sm:px-4"
              aria-label={t(lang, "home.search.filters")}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="mt-3 text-caption text-slate-500">
          {lang === "ru"
            ? "Поиск подключим на следующем этапе — сейчас интерфейс-прототип."
            : "Издөөнү кийинчерээк туташтырабыз — азыр интерфейс-прототип."}
        </p>
      </div>

      <section>
        <h2 className="font-manrope text-[1.5rem] font-semibold text-slate-900">
          {t(lang, "home.categories.title")}
        </h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SEED_SPECIALTY_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="shrink-0 rounded-full bg-white px-4 py-2.5 text-caption font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200/90 transition-colors hover:bg-teal-50 hover:ring-teal-200"
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-manrope text-[1.5rem] font-semibold text-slate-900">
          {t(lang, "home.doctors.title")}
        </h2>
        <div
          className={cn(
            "mt-4 grid gap-4",
            isDesktop ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1",
          )}
        >
          {SEED_DOCTORS.map((d) => (
            <DoctorCard key={d.id} doctor={d} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-manrope text-[1.5rem] font-semibold text-slate-900">{t(lang, "home.clinics.title")}</h2>
        <div
          className={cn(
            "mt-4 grid gap-4",
            isDesktop ? "md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1",
          )}
        >
          {SEED_CLINICS.map((c) => (
            <ClinicCard key={c.id} clinic={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
