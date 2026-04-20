import type { DoctorSummary, WpDoctorApi } from "@/lib/doctors-kg/types";

export const DOCTORS_KG_WP_BASE = "https://doctors.kg/wp-json/wp/v2/doctors_dir_ltg";

export function wpDoctorToSummary(row: WpDoctorApi): DoctorSummary {
  const classes = row.class_list ?? [];
  const categorySlugs = classes
    .filter((c) => c.startsWith("doctors_dir_cat-"))
    .map((c) => c.replace(/^doctors_dir_cat-/, ""));
  const locRaw = classes
    .filter((c) => c.startsWith("doctors_loc_loc-"))
    .map((c) => c.replace(/^doctors_loc_loc-/, ""));
  const cityCode = locRaw[0] ?? null;
  const cityFilterSlug = cityCode ? `loc-${cityCode}` : null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.title.rendered.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))),
    sourceUrl: row.link,
    categorySlugs,
    cityFilterSlug,
    cityCode,
  };
}

export type FetchWpDoctorsParams = {
  page?: number;
  perPage?: number;
  search?: string;
  categorySlug?: string;
  cityFilterSlug?: string;
};

export async function fetchWpDoctorsPage(params: FetchWpDoctorsParams): Promise<{
  doctors: DoctorSummary[];
  total: number;
  totalPages: number;
}> {
  const page = params.page ?? 1;
  const perPage = Math.min(params.perPage ?? 24, 100);
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", String(perPage));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.categorySlug) q.set("doctors_dir_cat", params.categorySlug);
  if (params.cityFilterSlug) q.set("doctors_loc_loc", params.cityFilterSlug);

  const url = `${DOCTORS_KG_WP_BASE}?${q.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    throw new Error(`doctors.kg WP ${res.status}`);
  }
  const total = Number(res.headers.get("X-WP-Total") ?? "0");
  const totalPages = Number(res.headers.get("X-WP-TotalPages") ?? "1");
  const rows = (await res.json()) as WpDoctorApi[];
  return {
    doctors: rows.map(wpDoctorToSummary),
    total,
    totalPages,
  };
}

/** Все врачи (для мета-справочника категорий/городов). Пагинация по 100. */
export async function fetchAllWpDoctorSummaries(): Promise<DoctorSummary[]> {
  let page = 1;
  let totalPages = 1;
  const all: DoctorSummary[] = [];
  do {
    const { doctors, totalPages: tp } = await fetchWpDoctorsPage({ page, perPage: 100 });
    totalPages = tp;
    all.push(...doctors);
    page++;
  } while (page <= totalPages);
  return all;
}
