import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pharmacy = await prisma.pharmacy.findFirst({
    where: { ownerProfileId: session.profileId },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      phones: true,
      latitude: true,
      longitude: true,
      workHours: true,
      isVerified: true,
      isActive: true,
      telegramNotifyChatId: true,
      createdAt: true,
    },
  });

  if (!pharmacy) {
    return NextResponse.json({ pharmacy: null });
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [responsesWeek, requestsToday] = await Promise.all([
    prisma.medicineRequestResponse.count({
      where: { pharmacyId: pharmacy.id, createdAt: { gte: since } },
    }),
    prisma.medicineRequest.count({
      where: {
        status: "OPEN",
        expiresAt: { gt: new Date() },
        createdAt: {
          gte: new Date(new Date().toDateString()),
        },
      },
    }),
  ]);

  return NextResponse.json({
    pharmacy: {
      ...pharmacy,
      stats: { responsesWeek, openRequestsApprox: requestsToday },
    },
  });
}
