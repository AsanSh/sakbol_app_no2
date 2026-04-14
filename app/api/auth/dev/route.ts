import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ensureFamilySubscription } from "@/lib/premium";
import { getOrCreateFirstDevAdmin } from "@/lib/dev-bootstrap";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/session";

export const dynamic = "force-dynamic";

function dbErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P1001") {
      return "База жок же өчүк эмес. Терминалда: docker compose up -d, андан кийин npx prisma migrate deploy";
    }
    if (err.code === "P2021" || err.code === "P2010") {
      return "Схема эски. Иштетиңиз: npx prisma migrate deploy";
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Database error";
}

/**
 * Демо / dev: сессия под первым ADMIN (после seed или авто-создания в development).
 */
export async function POST() {
  if (process.env.ALLOW_DEV_LOGIN !== "true") {
    return NextResponse.json({ error: "Dev login disabled" }, { status: 403 });
  }

  try {
    const admin = await getOrCreateFirstDevAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          error:
            "No admin profile. Run: docker compose up -d && npx prisma migrate deploy && npm run db:seed",
        },
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
  } catch (e: unknown) {
    const msg = dbErrorMessage(e);
    console.error("[/api/auth/dev]", e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
