import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { analyzeMedicalImage } from "@/lib/groq-ai-service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GROQ_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "GROQ_API_KEY не задан на сервере. Добавьте ключ в переменные окружения." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Некорректный FormData." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Поле file обязательно." }, { status: 400 });
  }

  const targetLanguage = (formData.get("targetLanguage") as string | null)?.trim() || "Russian";

  const mimeType = file.type || "image/jpeg";
  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return NextResponse.json(
      { error: `Тип файла не поддерживается: ${mimeType}` },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Файл слишком большой (макс. 20 МБ)." }, { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of analyzeMedicalImage(base64, mimeType, targetLanguage)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ошибка анализа.";
        controller.enqueue(encoder.encode(`\n\n[Ошибка: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
