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
 * Development-only: attach session to the first ADMIN profile (e.g. after seed).
 * Enable with ALLOW_DEV_LOGIN=true in .env
 */
export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
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
