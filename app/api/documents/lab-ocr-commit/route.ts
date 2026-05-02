import { NextResponse } from "next/server";
import { commitConfirmedLabUpload } from "@/app/actions/health-record";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false as const, error: "Ожидался multipart/form-data." }, { status: 400 });
  }

  try {
    const result = await commitConfirmedLabUpload(form);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[lab-ocr-commit]", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: e instanceof Error ? e.message : "Не удалось сохранить запись.",
      },
      { status: 500 },
    );
  }
}
