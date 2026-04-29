import { NextRequest, NextResponse } from "next/server";
import { MedicineRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notifyPharmaciesNewMedicineRequest } from "@/lib/medicine-request-telegram";

export const dynamic = "force-dynamic";

function serializeRequest(row: {
  id: string;
  medicineName: string;
  note: string | null;
  imageUrl: string | null;
  status: MedicineRequestStatus;
  expiresAt: Date;
  createdAt: Date;
  responses: Array<{
    id: string;
    inStock: boolean;
    price: number | null;
    priceUnit: string | null;
    note: string | null;
    createdAt: Date;
    pharmacy: {
      id: string;
      name: string;
      address: string;
      city: string;
      phones: string[];
      workHours: string | null;
      latitude: number | null;
      longitude: number | null;
    };
  }>;
}) {
  return {
    id: row.id,
    medicineName: row.medicineName,
    note: row.note,
    imageUrl: row.imageUrl,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    responses: row.responses.map((r) => ({
      id: r.id,
      inStock: r.inStock,
      price: r.price,
      priceUnit: r.priceUnit,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      pharmacy: r.pharmacy,
    })),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.medicineRequest.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      responses: {
        orderBy: { createdAt: "desc" },
        include: {
          pharmacy: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              phones: true,
              workHours: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    requests: rows.map(serializeRequest),
  });
}

type PostBody = {
  medicineName?: string;
  note?: string | null;
  imageUrl?: string | null;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const medicineName = String(body.medicineName ?? "").trim();
  const note = body.note != null ? String(body.note).trim().slice(0, 500) : null;
  const imageUrl =
    body.imageUrl != null && String(body.imageUrl).startsWith("https://")
      ? String(body.imageUrl).slice(0, 500)
      : null;

  if (medicineName.length < 2) {
    return NextResponse.json({ error: "Укажите название лекарства." }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const created = await prisma.medicineRequest.create({
    data: {
      profileId: session.profileId,
      medicineName,
      note: note || null,
      imageUrl,
      expiresAt,
      status: MedicineRequestStatus.OPEN,
    },
    include: {
      responses: {
        include: {
          pharmacy: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              phones: true,
              workHours: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      },
    },
  });

  void notifyPharmaciesNewMedicineRequest({
    medicineName,
    note: note || null,
  }).catch((e) => console.error("[medicine-request] notify pharmacies", e));

  return NextResponse.json({ request: serializeRequest(created) });
}
