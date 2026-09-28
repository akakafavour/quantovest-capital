import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { getCurrentIdentity } from '@/lib/supabase/identity';
import { getDb } from '@/lib/db';
import { users, recoveryCodes } from '@/db/schema';
import { generateRecoveryCodes } from '@/lib/recovery-codes';
import { verifyTOTP } from '@/lib/totp';
import { createTwoFactorToken } from '@/lib/2fa-session';
import {
  checkAuthRateLimit,
  clearAuthFailures,
  rateLimitHeaders,
  recordAuthFailure,
} from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const TOO_MANY = 'Too many attempts. Please wait 10 minutes and try again.';

export async function POST(request: Request) {
  const actor = await getCurrentIdentity();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });

  const body = await request.json().catch(() => null) as {
    action?: 'enable' | 'disable' | 'challenge' | 'verify';
    secret?: string;
    code?: string;
  } | null;
  if (!body?.action) return NextResponse.json({ error: 'Action is required.' }, { status: 400 });
  if (body.action === 'challenge') {
    cookies().set('qv_2fa_pending', '1', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' });
    return NextResponse.json({ challenged: true });
  }
  if (!body.code) return NextResponse.json({ error: 'Verification code is required.' }, { status: 400 });

  const [user] = await db.select({ twoFactorEnabled: users.twoFactorEnabled, twoFactorSecret: users.twoFactorSecret }).from(users).where(eq(users.id, actor.id)).limit(1);
  if (!user) return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });

  if (body.action === 'enable') {
    const secret = body.secret?.trim();
    if (!secret || !(await verifyTOTP(secret, body.code))) {
      return NextResponse.json({ error: 'Invalid authenticator code.' }, { status: 400 });
    }
    await db.update(users).set({ twoFactorEnabled: true, twoFactorSecret: secret }).where(eq(users.id, actor.id));
    const recovery = await generateRecoveryCodes(actor.id);
    return NextResponse.json({ enabled: true, recoveryCodes: recovery });
  }

  if (body.action === 'verify') {
    const limit = await checkAuthRateLimit(`2fa:verify:${actor.id}`);
    if (!limit.allowed) {
      return NextResponse.json({ error: TOO_MANY }, { status: 429, headers: rateLimitHeaders(limit) });
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret || !(await verifyTOTP(user.twoFactorSecret, body.code))) {
      await recordAuthFailure(`2fa:verify:${actor.id}`);
      return NextResponse.json({ error: 'Invalid authenticator code.' }, { status: 400 });
    }
    await clearAuthFailures(`2fa:verify:${actor.id}`);
    const token = await createTwoFactorToken(actor.id);
    const response = NextResponse.json({ verified: true });
    response.cookies.set('qv_2fa_verified', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 3600, path: '/' });
    response.cookies.set('qv_2fa_pending', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' });
    return response;
  }

  if (body.action === 'disable') {
    const limit = await checkAuthRateLimit(`2fa:disable:${actor.id}`);
    if (!limit.allowed) {
      return NextResponse.json({ error: TOO_MANY }, { status: 429, headers: rateLimitHeaders(limit) });
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret || !(await verifyTOTP(user.twoFactorSecret, body.code))) {
      await recordAuthFailure(`2fa:disable:${actor.id}`);
      return NextResponse.json({ error: 'Invalid authenticator code.' }, { status: 400 });
    }
    await clearAuthFailures(`2fa:disable:${actor.id}`);
    await db.transaction(async tx => {
      await tx.update(users).set({ twoFactorEnabled: false, twoFactorSecret: null }).where(eq(users.id, actor.id));
      await tx.delete(recoveryCodes).where(and(eq(recoveryCodes.userId, actor.id), isNull(recoveryCodes.usedAt)));
    });
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({ error: 'Unsupported 2FA action.' }, { status: 400 });
}
