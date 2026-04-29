import { NextResponse } from "next/server";
import { MedicineRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const rid = id.trim();
  if (!rid) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const row = await prisma.medicineRequest.findFirst({
    where: { id: rid, profileId: session.profileId },
  });
  if (!row) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  await prisma.medicineRequest.update({
    where: { id: row.id },
    data: { status: MedicineRequestStatus.CLOSED },
  });

  return NextResponse.json({ ok: true });
}
