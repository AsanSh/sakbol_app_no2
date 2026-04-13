import { NextResponse } from "next/server";
import { ensureFamilySubscription } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Демо / dev: сессия под первым ADMIN (после seed).
 * Локально: NODE_ENV=development + ALLOW_DEV_LOGIN=true.
 * Vercel / браузер: ALLOW_DEV_LOGIN=true + NEXT_PUBLIC_ALLOW_DEV_LOGIN=true (только для демо-домена).
 */
export async function POST() {
  if (process.env.ALLOW_DEV_LOGIN !== "true") {
    return NextResponse.json({ error: "Dev login disabled" }, { status: 403 });
  }

  const admin = await prisma.profile.findFirst({
    where: { familyRole: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) {
    return NextResponse.json(
      { error: "No admin profile. Run npm run db:seed" },
      { status: 404 },
    );
  }

  const token = createSessionToken({
    profileId: admin.id,
    familyId: admin.familyId,
  });
  await ensureFamilySubscription(admin.familyId);

  const res = NextResponse.json({
    ok: true,
    profile: {
      id: admin.id,
      displayName: admin.displayName,
      avatarUrl: admin.avatarUrl,
      familyRole: admin.familyRole,
      familyId: admin.familyId,
    },
  });
  res.cookies.set(sessionCookieName(), token, sessionCookieOptions());
  return res;
}
