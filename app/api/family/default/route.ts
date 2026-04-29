import { NextResponse } from "next/server";
import { applyPendingProfileAccessForTelegramUser } from "@/lib/profile-access-accept";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const PROFILE_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
  email: true,
  familyRole: true,
  isManaged: true,
  telegramUserId: true,
  managedRole: true,
  dateOfBirth: true,
  biologicalSex: true,
  heightCm: true,
  weightKg: true,
  bloodType: true,
  medCardIsDoctor: true,
  medCardDoctorNote: true,
  medCardIsCaregiver: true,
  medCardCaregiverNote: true,
} as const;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Подтянуть отложенные /start share_… если при логине applyPending не отработал (гонка, другой путь входа).
    const grantee = await prisma.profile.findUnique({
      where: { id: session.profileId },
      select: { telegramUserId: true },
    });
    if (grantee?.telegramUserId) {
      try {
        await applyPendingProfileAccessForTelegramUser(
          grantee.telegramUserId,
          session.profileId,
        );
      } catch (e) {
        console.error("[family/default] applyPendingProfileAccess", e);
      }
    }

    const [family, sharedAccesses] = await Promise.all([
      prisma.family.findUnique({
        where: { id: session.familyId },
        include: {
          plan: { select: { tier: true } },
          profiles: {
            orderBy: { createdAt: "asc" },
            select: PROFILE_SELECT,
          },
        },
      }),
      // Профили чужих семей, к которым текущий профиль имеет доступ
      prisma.profileAccess.findMany({
        where: {
          granteeProfileId: session.profileId,
          acceptedAt: { not: null },
          revokedAt: null,
        },
        select: {
          id: true,
          canWrite: true,
          acceptedAt: true,
          sourceProfile: { select: PROFILE_SELECT },
        },
      }),
    ]);

    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Добавляем расшаренные профили с флагом isSharedGuest
    const sharedProfiles = sharedAccesses.map((a) => ({
      ...a.sourceProfile,
      isSharedGuest: true,
      sharedAccessId: a.id,
      sharedCanWrite: a.canWrite,
      sharedAcceptedAt: a.acceptedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      ...family,
      tier: family.plan?.tier ?? "FREE",
      sharedProfiles,
    });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and Postgres." },
      { status: 503 },
    );
  }
}
