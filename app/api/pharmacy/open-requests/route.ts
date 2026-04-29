import { NextResponse } from "next/server";
import { MedicineRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pharmacy = await prisma.pharmacy.findFirst({
    where: { ownerProfileId: session.profileId, isActive: true },
    select: { id: true },
  });

  if (!pharmacy) {
    return NextResponse.json({ error: "Аптека не зарегистрирована" }, { status: 403 });
  }

  const now = new Date();
  const rows = await prisma.medicineRequest.findMany({
    where: {
      status: MedicineRequestStatus.OPEN,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      medicineName: true,
      note: true,
      createdAt: true,
      responses: {
        where: { pharmacyId: pharmacy.id },
        select: { id: true },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    requests: rows.map((r) => ({
      id: r.id,
      medicineName: r.medicineName,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      alreadyResponded: r.responses.length > 0,
    })),
  });
}
