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
