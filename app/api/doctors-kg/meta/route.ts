import { NextResponse } from "next/server";
import {
  cityLabel,
  deriveClinicsFromEnriched,
  loadDoctorsKgEnrichedFile,
  prettyCategorySlug,
} from "@/lib/doctors-kg/enriched-store";
import { fetchAllWpDoctorSummaries } from "@/lib/doctors-kg/wp-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Категории, города, клиники; при отсутствии JSON — только индекс WP. */
export async function GET() {
  try {
    const file = await loadDoctorsKgEnrichedFile();
    if (file?.doctors?.length) {
      const catSet = new Set<string>();
      const citySet = new Set<string>();
      for (const d of file.doctors) {
        d.categorySlugs.forEach((c) => catSet.add(c));
        if (d.cityCode) citySet.add(d.cityCode);
      }
      const categories = Array.from(catSet)
        .sort()
        .map((slug) => ({ slug, label: prettyCategorySlug(slug) }));
      const cities = Array.from(citySet)
        .sort()
        .map((code) => ({
          filterSlug: `loc-${code}`,
          code,
          label: cityLabel(code),
        }));
      const clinics = deriveClinicsFromEnriched(file.doctors);
      return NextResponse.json({
        source: file.source,
        generatedAt: file.generatedAt,
        categories,
        cities,
        clinics,
        doctorCount: file.doctors.length,
      });
    }

    const summaries = await fetchAllWpDoctorSummaries();
    const catSet = new Set<string>();
    const citySet = new Set<string>();
    for (const d of summaries) {
      d.categorySlugs.forEach((c) => catSet.add(c));
      if (d.cityCode) citySet.add(d.cityCode);
    }
    const categories = Array.from(catSet)
      .sort()
      .map((slug) => ({ slug, label: prettyCategorySlug(slug) }));
    const cities = Array.from(citySet)
      .sort()
      .map((code) => ({
        filterSlug: `loc-${code}`,
        code,
        label: cityLabel(code),
      }));

    return NextResponse.json({
      source: "https://doctors.kg (WP only — run npm run doctors-kg:sync for phones)",
      generatedAt: null,
      categories,
      cities,
      clinics: [],
      doctorCount: summaries.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
