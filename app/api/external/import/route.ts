import { POST as uploadAutomatedPost } from "@/app/api/documents/upload-automated/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Алиас для автоматизации: тот же контракт, что POST /api/documents/upload-automated
 * (file, adeskId | fullName, category, title?, documentDate?).
 */
export async function POST(req: Request) {
  return uploadAutomatedPost(req);
}
