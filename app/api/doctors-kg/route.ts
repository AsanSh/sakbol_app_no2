import { NextResponse } from "next/server";
import { enrichSummariesFromFile } from "@/lib/doctors-kg/enriched-store";
import { fetchWpDoctorsPage } from "@/lib/doctors-kg/wp-api";

export const runtime = "nodejs";

/**
 * Прокси к doctors.kg (WordPress) + слияние с локальным JSON (телефоны, адрес).
 * query: search, category, city (loc-bishkek), page, perPage
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? undefined;
    const categorySlug = searchParams.get("category") ?? undefined;
    const cityFilterSlug = searchParams.get("city") ?? undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage") ?? "24")));

    const { doctors, total, totalPages } = await fetchWpDoctorsPage({
      page,
      perPage,
      search,
      categorySlug: categorySlug || undefined,
      cityFilterSlug: cityFilterSlug || undefined,
    });

    const merged = await enrichSummariesFromFile(doctors);

    return NextResponse.json({
      page,
      perPage,
      total,
      totalPages,
      doctors: merged,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
