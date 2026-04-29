import { NextRequest, NextResponse } from "next/server";
import { MedicineRequestStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notifyUserMedicineResponse } from "@/lib/medicine-request-telegram";

export const dynamic = "force-dynamic";

type Body = {
  inStock?: boolean;
  price?: number | null;
  priceUnit?: string | null;
  note?: string | null;
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ requestId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pharmacy = await prisma.pharmacy.findFirst({
    where: { ownerProfileId: session.profileId, isActive: true },
  });
  if (!pharmacy) {
    return NextResponse.json({ error: "Аптека не зарегистрирована" }, { status: 403 });
  }

  const { requestId } = await ctx.params;
  const rid = requestId.trim();
  if (!rid) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inStock = body.inStock !== false;
  const price =
    body.price != null && Number.isFinite(Number(body.price)) ? Number(body.price) : null;
  const priceUnit =
    body.priceUnit != null ? String(body.priceUnit).trim().slice(0, 12) || "сом" : "сом";
  const note = body.note != null ? String(body.note).trim().slice(0, 500) : null;

  const now = new Date();
  const request = await prisma.medicineRequest.findFirst({
    where: {
      id: rid,
      status: MedicineRequestStatus.OPEN,
      expiresAt: { gt: now },
    },
    include: {
      profile: { select: { id: true, telegramUserId: true } },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Заявка не найдена или закрыта" }, { status: 404 });
  }

  try {
    const response = await prisma.medicineRequestResponse.create({
      data: {
        requestId: request.id,
        pharmacyId: pharmacy.id,
        inStock,
        price,
        priceUnit,
        note: note || null,
      },
    });

    const fullPharmacy = await prisma.pharmacy.findUnique({
      where: { id: pharmacy.id },
      select: {
        name: true,
        address: true,
        city: true,
        phones: true,
        workHours: true,
        latitude: true,
        longitude: true,
      },
    });

    if (request.profile.telegramUserId && fullPharmacy) {
      const n = await notifyUserMedicineResponse({
        telegramUserId: request.profile.telegramUserId,
        pharmacyName: fullPharmacy.name,
        address: fullPharmacy.address,
        city: fullPharmacy.city,
        workHours: fullPharmacy.workHours,
        medicineName: request.medicineName,
        inStock,
        price,
        priceUnit,
        note: note || null,
        phones: fullPharmacy.phones,
        latitude: fullPharmacy.latitude,
        longitude: fullPharmacy.longitude,
      });
      await prisma.medicineRequestResponse.update({
        where: { id: response.id },
        data: { notifiedAt: n.ok ? new Date() : null },
      });
    }

    return NextResponse.json({
      ok: true,
      response: {
        id: response.id,
        inStock: response.inStock,
        price: response.price,
        priceUnit: response.priceUnit,
        note: response.note,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Вы уже ответили на эту заявку" }, { status: 409 });
    }
    throw e;
  }
}
