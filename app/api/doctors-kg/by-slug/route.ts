import { NextResponse } from "next/server";
import { loadDoctorsKgEnrichedFile } from "@/lib/doctors-kg/enriched-store";

export const runtime = "nodejs";

/** Одна карточка из локального кэша (для клиник / глубоких ссылок без ухода на doctors.kg). */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  const file = await loadDoctorsKgEnrichedFile();
  const doctor = file?.doctors.find((d) => d.slug === slug) ?? null;
  if (!doctor) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ doctor });
}
