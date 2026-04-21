import type { LocalBusinessLd } from "@/lib/doctors-kg/types";

function walkGraph(obj: unknown, out: LocalBusinessLd[]): void {
  if (!obj || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;
  if (o["@graph"] && Array.isArray(o["@graph"])) {
    for (const item of o["@graph"]) walkGraph(item, out);
    return;
  }
  if (o["@type"] === "LocalBusiness") {
    out.push(o as unknown as LocalBusinessLd);
  }
}

/** Достаёт первый LocalBusiness из JSON-LD на странице doctors.kg. */
export function extractLocalBusinessFromHtml(html: string): LocalBusinessLd | null {
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
  return found[0] ?? null;
}

export function normalizePhones(tel: LocalBusinessLd["telephone"]): string[] {
  if (!tel) return [];
  const arr = Array.isArray(tel) ? tel : [tel];
  return arr.map((s) => s.trim()).filter(Boolean);
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

function shortenDay(raw: string): string {
  const u = raw.replace(/https?:\/\/schema\.org\//i, "").split("/").pop() ?? raw;
  return DAY_SHORT_RU[u] ?? u.slice(0, 2).toLowerCase();
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
      const dayStr = dayList.map((d) => shortenDay(String(d))).join(", ");
      if (s.opens && s.closes) {
        out.push(dayStr ? `${dayStr}: ${s.opens}–${s.closes}` : `${s.opens}–${s.closes}`);
      } else if (s.opens) {
        out.push(dayStr ? `${dayStr}: ${s.opens}` : s.opens);
      }
    }
  }
  return out;
}
