import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notifyPharmacyOwnerLinkBot } from "@/lib/medicine-request-telegram";

export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  address?: string;
  city?: string;
  phones?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  workHours?: string | null;
};

function cleanPhones(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => String(p ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const address = String(body.address ?? "").trim();
  const city = String(body.city ?? "Бишкек").trim() || "Бишкек";
  const phones = cleanPhones(body.phones);
  const workHours = body.workHours != null ? String(body.workHours).trim().slice(0, 200) : null;

  if (name.length < 2) {
    return NextResponse.json({ error: "Укажите название аптеки." }, { status: 400 });
  }
  if (address.length < 3) {
    return NextResponse.json({ error: "Укажите адрес." }, { status: 400 });
  }
  if (phones.length === 0) {
    return NextResponse.json({ error: "Укажите хотя бы один телефон." }, { status: 400 });
  }

  const lat = typeof body.latitude === "number" && Number.isFinite(body.latitude) ? body.latitude : null;
  const lng = typeof body.longitude === "number" && Number.isFinite(body.longitude) ? body.longitude : null;

  const existing = await prisma.pharmacy.findFirst({
    where: { ownerProfileId: session.profileId },
  });
  if (existing) {
    return NextResponse.json({ error: "У этого профиля уже зарегистрирована аптека." }, { status: 409 });
  }

  const pharmacy = await prisma.pharmacy.create({
    data: {
      name,
      address,
      city,
      phones,
      latitude: lat,
      longitude: lng,
      workHours: workHours || null,
      ownerProfileId: session.profileId,
    },
  });

  const profile = await prisma.profile.findUnique({
    where: { id: session.profileId },
    select: { telegramUserId: true },
  });
  if (profile?.telegramUserId) {
    void notifyPharmacyOwnerLinkBot(profile.telegramUserId).catch(() => {});
  }

  return NextResponse.json({
    id: pharmacy.id,
    name: pharmacy.name,
    address: pharmacy.address,
    city: pharmacy.city,
    phones: pharmacy.phones,
  });
}
