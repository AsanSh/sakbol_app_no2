import { NextResponse } from "next/server";
import { loadDoctorsKgEnrichedFile } from "@/lib/doctors-kg/enriched-store";
import { patchDoctorFromListingHtml } from "@/lib/doctors-kg/live-enrich";
import type { DoctorEnriched } from "@/lib/doctors-kg/types";

export const runtime = "nodejs";

const UA = "SakBolDirectory/1.0 (+https://sakbol.vercel.app)";

function mergeLivePatch(
  base: DoctorEnriched | undefined,
  patch: Partial<DoctorEnriched>,
  slug: string,
  listingUrl: string,
): DoctorEnriched {
  const b =
    base ??
    ({
      id: 0,
      slug,
      name: slug.replace(/-/g, " "),
      sourceUrl: listingUrl,
      categorySlugs: [],
      cityFilterSlug: null,
      cityCode: null,
      telephones: [],
      streetAddress: null,
      locality: null,
      region: null,
      country: null,
      website: null,
      image: null,
      priceRange: null,
      latitude: null,
      longitude: null,
    } satisfies DoctorEnriched);

  const out: DoctorEnriched = { ...b, ...patch, slug, sourceUrl: base?.sourceUrl ?? listingUrl };
  if (!out.telephones?.length && b.telephones?.length) out.telephones = b.telephones;
  if (!out.description?.trim() && b.description?.trim()) out.description = b.description;
  if (!out.openingHoursLines?.length && b.openingHoursLines?.length) {
    out.openingHoursLines = b.openingHoursLines;
  }
  if (!out.priceRange && b.priceRange) out.priceRange = b.priceRange;
  if (out.latitude == null && b.latitude != null) out.latitude = b.latitude;
  if (out.longitude == null && b.longitude != null) out.longitude = b.longitude;
  if (!out.streetAddress && b.streetAddress) out.streetAddress = b.streetAddress;
  if (!out.image && b.image) out.image = b.image;
  return out;
}

/**
 * Подтягивает JSON-LD с карточки doctors.kg (описание, цены, часы) и сливает с локальным кэшем.
 * Кэш HTTP ~1 ч — чтобы не ддосить источник.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const file = await loadDoctorsKgEnrichedFile();
  const base = file?.doctors.find((d) => d.slug === slug);
  const url =
    base?.sourceUrl ?? `https://doctors.kg/directory-doctors/listing/${encodeURIComponent(slug)}/`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": UA },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `listing ${res.status}` }, { status: 502 });
    }
    const html = await res.text();
    const patch = patchDoctorFromListingHtml(html);
    const doctor = mergeLivePatch(base, patch, slug, url);

    if (!base && !doctor.name?.trim()) {
      doctor.name = slug
        .split("-")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }

    return NextResponse.json({ doctor });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
