import { NextRequest, NextResponse } from "next/server";
import { MedicineRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Помечает просроченные заявки EXPIRED. Защита: Authorization: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = await prisma.medicineRequest.updateMany({
    where: {
      status: MedicineRequestStatus.OPEN,
      expiresAt: { lt: now },
    },
    data: { status: MedicineRequestStatus.EXPIRED },
  });

  return NextResponse.json({ updated: result.count });
}
