import type { LocalBusinessLd } from "@/lib/doctors-kg/types";

function typeIsLocalBusiness(t: unknown): boolean {
  if (t === "LocalBusiness") return true;
  if (t === "http://schema.org/LocalBusiness") return true;
  if (t === "https://schema.org/LocalBusiness") return true;
  if (Array.isArray(t)) return t.some(typeIsLocalBusiness);
  return false;
}

function walkGraph(obj: unknown, out: LocalBusinessLd[]): void {
  if (!obj || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;

  if (typeIsLocalBusiness(o["@type"])) {
    out.push(o as unknown as LocalBusinessLd);
    return;
  }

  if (o["@graph"] && Array.isArray(o["@graph"])) {
    for (const item of o["@graph"]) walkGraph(item, out);
  }
}

function scoreLocalBusiness(ld: LocalBusinessLd): number {
  let s = 0;
  if (ld.telephone) s += 8;
  if (ld.description) s += Math.min(ld.description.length, 400);
  if (ld.priceRange) s += 15;
  if (ld.geo && typeof ld.geo.latitude === "number") s += 5;
  if (ld.address?.streetAddress) s += 3;
  return s;
}

/** Все блоки LocalBusiness со страницы (часто несколько script type=ld+json). */
export function extractAllLocalBusinessFromHtml(html: string): LocalBusinessLd[] {
  const found: LocalBusinessLd[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const j = JSON.parse(raw) as unknown;
      walkGraph(j, found);
    } catch {
      /* skip invalid JSON */
    }
  }
  return found;
}

/** Лучший кандидат LocalBusiness (описание, цены, телефон). */
export function extractBestLocalBusinessFromHtml(html: string): LocalBusinessLd | null {
  const all = extractAllLocalBusinessFromHtml(html);
  if (!all.length) return null;
  all.sort((a, b) => scoreLocalBusiness(b) - scoreLocalBusiness(a));
  return all[0] ?? null;
}

/** @deprecated Используйте extractBestLocalBusinessFromHtml; имя сохранено для скриптов. */
export const extractLocalBusinessFromHtml = extractBestLocalBusinessFromHtml;

export function normalizePhones(tel: LocalBusinessLd["telephone"]): string[] {
  if (!tel) return [];
  const arr = Array.isArray(tel) ? tel : [tel];
  const out: string[] = [];
  for (const raw of arr) {
    const chunks = String(raw)
      .split(/\s*[,;/|]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const c of chunks) out.push(c);
  }
  return Array.from(new Set(out));
}

const DAY_SHORT_RU: Record<string, string> = {
  Monday: "пн",
  Tuesday: "вт",
  Wednesday: "ср",
  Thursday: "чт",
  Friday: "пт",
  Saturday: "сб",
  Sunday: "вс",
};

function dayLabel(raw: string): string {
  const s = String(raw).trim();
  if (!s) return "";
  if (/[А-Яа-яЁё]/.test(s)) return s;
  const u = s.replace(/https?:\/\/schema\.org\//i, "").split("/").pop() ?? s;
  return DAY_SHORT_RU[u] ?? u.slice(0, 3).toLowerCase();
}

/** Человекочитаемые строки часов работы из JSON-LD LocalBusiness. */
export function openingHoursLinesFromLd(ld: LocalBusinessLd | null): string[] {
  if (!ld) return [];
  const out: string[] = [];
  if (ld.openingHours) {
    const arr = Array.isArray(ld.openingHours) ? ld.openingHours : [ld.openingHours];
    for (const s of arr) {
      const t = String(s).trim();
      if (t) out.push(t);
    }
  }
  const specs = ld.openingHoursSpecification;
  if (Array.isArray(specs)) {
    for (const s of specs) {
      const days = s.dayOfWeek;
      const dayList = Array.isArray(days) ? days : days ? [days] : [];
      const dayStr = dayList.map((d) => dayLabel(String(d))).filter(Boolean).join(", ");
      if (s.opens && s.closes) {
        out.push(dayStr ? `${dayStr}: ${s.opens}–${s.closes}` : `${s.opens}–${s.closes}`);
      } else if (s.opens) {
        out.push(dayStr ? `${dayStr}: ${s.opens}` : s.opens);
      }
    }
  }
  return out;
}
