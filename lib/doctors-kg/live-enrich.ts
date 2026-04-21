import { decodeHtmlEntities } from "@/lib/html-entities";
import {
  extractBestLocalBusinessFromHtml,
  normalizePhones,
  openingHoursLinesFromLd,
} from "@/lib/doctors-kg/parse-ld";
import type { DoctorEnriched, LocalBusinessLd } from "@/lib/doctors-kg/types";

export function patchDoctorFieldsFromLd(ld: LocalBusinessLd | null): Partial<DoctorEnriched> {
  if (!ld) return {};
  const descRaw = typeof ld.description === "string" ? ld.description : "";
  const desc = decodeHtmlEntities(descRaw).trim() || null;
  const priceRaw = typeof ld.priceRange === "string" ? ld.priceRange : "";
  const price = decodeHtmlEntities(priceRaw).trim() || null;

  const street = ld.address?.streetAddress;
  const locality = ld.address?.addressLocality;
  const region = ld.address?.addressRegion;

  return {
    telephones: normalizePhones(ld.telephone),
    streetAddress: street ? decodeHtmlEntities(street).trim() || null : null,
    locality: locality ? decodeHtmlEntities(locality).trim() || null : null,
    region: region ? decodeHtmlEntities(region).trim() || null : null,
    country: ld.address?.addressCountry ?? null,
    website: typeof ld.url === "string" ? ld.url : null,
    image: typeof ld.image === "string" ? ld.image : null,
    priceRange: price,
    latitude: typeof ld.geo?.latitude === "number" ? ld.geo.latitude : null,
    longitude: typeof ld.geo?.longitude === "number" ? ld.geo.longitude : null,
    description: desc,
    openingHoursLines: openingHoursLinesFromLd(ld).map((x) => decodeHtmlEntities(x)),
  };
}

export function patchDoctorFromListingHtml(html: string): Partial<DoctorEnriched> {
  return patchDoctorFieldsFromLd(extractBestLocalBusinessFromHtml(html));
}
