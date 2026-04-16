import fs from "fs";
import path from "path";

export type LabReferencePayload = {
  source: string;
  pagesApprox?: number;
  chunkCount: number;
  chunks: { id: string; text: string }[];
};

let cache: LabReferencePayload | null | undefined;

export function loadLabReferencePayload(): LabReferencePayload | null {
  if (cache !== undefined) return cache;
  const f = path.join(process.cwd(), "data", "lab-reference-chunks.json");
  if (!fs.existsSync(f)) {
    cache = null;
    return null;
  }
  try {
    const raw = fs.readFileSync(f, "utf8");
    cache = JSON.parse(raw) as LabReferencePayload;
    return cache;
  } catch {
    cache = null;
    return null;
  }
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-zа-яёәүңөүқһі0-9]+/i)
    .filter((t) => t.length > 2);
}

function scoreChunk(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  let s = 0;
  for (const t of tokens) {
    if (lower.includes(t)) s += Math.min(t.length, 12);
  }
  return s;
}

const MAX_SNIPPET = 1400;

/**
 * Простой поиск по фрагментам книги Хиггинс (ключевые слова из вопроса).
 */
export function searchLabReference(query: string, topK = 4): { text: string; score: number }[] {
  const payload = loadLabReferencePayload();
  if (!payload?.chunks?.length) return [];
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored = payload.chunks.map((c) => ({
    text: c.text.length > MAX_SNIPPET ? `${c.text.slice(0, MAX_SNIPPET)}…` : c.text,
    score: scoreChunk(c.text, tokens),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((x) => x.score > 0).slice(0, topK);
}
