import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/supabase/identity";
import { createTwoFactorToken } from "@/lib/2fa-session";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { verifyRecoveryCode } from "@/lib/recovery-codes";
import {
  checkAuthRateLimit,
  clearAuthFailures,
  rateLimitHeaders,
  recordAuthFailure,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      userId?: string;
      code?: string;
    } | null;

    const actor = await getCurrentIdentity();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!body?.code) return NextResponse.json({ error: "Recovery code is required." }, { status: 400 });
    const userId = actor.id;

    const db = getDb();
    if (!db) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

    const rows = await db.select({ twoFactorEnabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!rows[0] || !rows[0].twoFactorEnabled) {
      return NextResponse.json({ error: "2FA is not enabled for this account." }, { status: 400 });
    }

    const limit = await checkAuthRateLimit(`recover:${userId}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait 10 minutes and try again." },
        { status: 429, headers: rateLimitHeaders(limit) },
      );
    }
    const valid = await verifyRecoveryCode(userId, body.code);
    if (!valid) {
      await recordAuthFailure(`recover:${userId}`);
      return NextResponse.json({ error: "Invalid or already used recovery code." }, { status: 401 });
    }
    await clearAuthFailures(`recover:${userId}`);

    const response = NextResponse.json({ verified: true });
    response.cookies.set('qv_2fa_verified', await createTwoFactorToken(userId), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 3600, path: '/' });
    response.cookies.set('qv_2fa_pending', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' });
    return response;
  } catch (err) {
    console.error("[auth recover]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
