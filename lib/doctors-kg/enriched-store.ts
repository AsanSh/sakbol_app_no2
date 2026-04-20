import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ClinicDerived, DoctorEnriched } from "@/lib/doctors-kg/types";

export type DoctorsKgFilePayload = {
  generatedAt: string;
  source: string;
  doctors: DoctorEnriched[];
};

let memory: DoctorsKgFilePayload | null = null;

export async function loadDoctorsKgEnrichedFile(): Promise<DoctorsKgFilePayload | null> {
  if (memory) return memory;
  try {
    const p = path.join(process.cwd(), "public", "data", "doctors-kg-enriched.json");
    const raw = await readFile(p, "utf-8");
    memory = JSON.parse(raw) as DoctorsKgFilePayload;
    return memory;
  } catch {
    return null;
  }
}

/** Подстановка телефонов/адреса из локального кэша по slug. */
export async function enrichSummariesFromFile<T extends { slug: string }>(
  rows: T[],
): Promise<(T & Partial<DoctorEnriched>)[]> {
  const file = await loadDoctorsKgEnrichedFile();
  if (!file) return rows.map((r) => ({ ...r }));
  const map = new Map(file.doctors.map((d) => [d.slug, d]));
  return rows.map((r) => {
    const e = map.get(r.slug);
    if (!e) return { ...r };
    return {
      ...r,
      telephones: e.telephones,
      streetAddress: e.streetAddress,
      locality: e.locality,
      region: e.region,
      country: e.country,
      website: e.website,
      image: e.image,
      priceRange: e.priceRange,
      latitude: e.latitude,
      longitude: e.longitude,
    };
  });
}

const CITY_LABELS: Record<string, string> = {
  bishkek: "Бишкек",
  osh: "Ош",
  jalalabad: "Джалал-Абад",
  "jalal-abad": "Джалал-Абад",
  karakol: "Каракол",
  naryn: "Нарын",
  talas: "Талас",
  batken: "Баткен",
  tokmok: "Токмок",
  kant: "Кант",
};

export function cityLabel(code: string | null): string {
  if (!code) return "";
  const k = code.toLowerCase();
  return CITY_LABELS[k] ?? code.split("-").map(cap).join(" ");
}

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function prettyCategorySlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => cap(w))
    .join(" ")
    .replace(/Iii/g, "III");
}

/** Клиники как уникальные адреса из обогащённых карточек. */
export function deriveClinicsFromEnriched(doctors: DoctorEnriched[]): ClinicDerived[] {
  const buckets = new Map<
    string,
    { address: string; city: string; phones: string[]; slugs: string[]; names: string[] }
  >();

  for (const d of doctors) {
    if (!d.streetAddress && !d.locality) continue;
    const phone = d.telephones[0] ?? "—";
    const city = d.locality ?? d.region ?? "";
    const addr = d.streetAddress ?? "";
    const key = `${addr}|${city}|${phone}`;
    const prev = buckets.get(key);
    const nameGuess = d.name.split(" ").slice(-2).join(" ") ? `Приём: ${d.name}` : d.name;
    if (!prev) {
      buckets.set(key, {
        address: addr,
        city,
        phones: Array.from(new Set(d.telephones)),
        slugs: [d.slug],
        names: [nameGuess],
      });
    } else {
      prev.slugs.push(d.slug);
      if (!prev.names.includes(nameGuess)) prev.names.push(nameGuess);
      for (const p of d.telephones) if (!prev.phones.includes(p)) prev.phones.push(p);
    }
  }

  return Array.from(buckets.entries()).map(([key, v], i) => ({
    id: `clinic-${i}-${key.slice(0, 24)}`,
    name: [v.address, v.city].filter(Boolean).join(" · ") || "Клиника / кабинет",
    address: v.address,
    city: v.city,
    phones: v.phones,
    doctorCount: new Set(v.slugs).size,
    sampleDoctorSlug: v.slugs[0],
  }));
}
