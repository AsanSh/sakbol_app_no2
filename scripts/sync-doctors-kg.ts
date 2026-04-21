/**
 * Один раз подтягивает всех врачей с doctors.kg (WP + JSON-LD на странице).
 * Результат: public/data/doctors-kg-enriched.json (для клиник и телефонов без N+1 в рантайме).
 *
 * Запуск: npx tsx scripts/sync-doctors-kg.ts
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  extractLocalBusinessFromHtml,
  normalizePhones,
  openingHoursLinesFromLd,
} from "../lib/doctors-kg/parse-ld";
import type { DoctorEnriched, DoctorSummary } from "../lib/doctors-kg/types";
import { fetchAllWpDoctorSummaries } from "../lib/doctors-kg/wp-api";

const DELAY_MS = 120;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function enrichOne(summary: DoctorSummary): Promise<DoctorEnriched> {
  const res = await fetch(summary.sourceUrl, {
    headers: { "User-Agent": "SakBolDirectorySync/1.0 (+https://sakbol.vercel.app)" },
  });
  const html = await res.text();
  const ld = extractLocalBusinessFromHtml(html);
  const phones = normalizePhones(ld?.telephone);
  return {
    ...summary,
    telephones: phones,
    streetAddress: ld?.address?.streetAddress ?? null,
    locality: ld?.address?.addressLocality ?? null,
    region: ld?.address?.addressRegion ?? null,
    country: ld?.address?.addressCountry ?? null,
    website: typeof ld?.url === "string" ? ld.url : null,
    image: typeof ld?.image === "string" ? ld.image : null,
    priceRange: typeof ld?.priceRange === "string" ? ld.priceRange : null,
    latitude: typeof ld?.geo?.latitude === "number" ? ld.geo.latitude : null,
    longitude: typeof ld?.geo?.longitude === "number" ? ld.geo.longitude : null,
    description: typeof ld?.description === "string" ? ld.description : null,
    openingHoursLines: openingHoursLinesFromLd(ld),
  };
}

async function main() {
  console.log("Fetching WP index…");
  const summaries = await fetchAllWpDoctorSummaries();
  console.log("Doctors:", summaries.length);
  const enriched: DoctorEnriched[] = [];
  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i];
    process.stdout.write(`\rEnrich ${i + 1}/${summaries.length} ${s.slug}`.padEnd(60, " "));
    try {
      enriched.push(await enrichOne(s));
    } catch (e) {
      console.error(`\nFail ${s.slug}`, e);
      enriched.push({
        ...s,
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
        description: null,
        openingHoursLines: [],
      });
    }
    await sleep(DELAY_MS);
  }
  console.log("\nWriting JSON…");
  const outDir = path.join(process.cwd(), "public", "data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "doctors-kg-enriched.json");
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "https://doctors.kg",
        doctors: enriched,
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log("Wrote", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
