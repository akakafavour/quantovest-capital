import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getDb } from '@/lib/db';
import { referralLinks, referralAttributions, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendWelcomeEmail } from '@/lib/notifications';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';
  const referralCode = cookies().get('referral_code')?.value || null;
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error('[auth callback exchange]', error?.message || 'No user returned from callback exchange');
      return NextResponse.redirect(new URL('/login?error=oauth_callback', requestUrl.origin));
    }
    if (data.user) {
      const db = getDb();
      if (db) {
        try {
          const authAvatar = typeof data.user.user_metadata?.avatar_url === 'string'
            ? data.user.user_metadata.avatar_url
            : typeof data.user.user_metadata?.picture === 'string'
              ? data.user.user_metadata.picture
              : null;
          const authName = data.user.user_metadata?.name ?? data.user.user_metadata?.full_name ?? data.user.email?.split('@')[0] ?? 'User';
          await db.insert(users).values({
            id: data.user.id,
            email: data.user.email ?? '',
            name: authName,
            image: authAvatar,
            role: 'investor',
          }).onConflictDoUpdate({
            target: users.id,
            set: {
              email: data.user.email ?? '',
              name: authName,
              image: authAvatar,
              role: 'investor',
            },
          });
          const rows = await db.select({ twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.id, data.user.id)).limit(1);
          if (referralCode) {
            try {
              const link = await db.select().from(referralLinks).where(eq(referralLinks.code, referralCode)).limit(1);
              if (link[0] && link[0].ownerId !== data.user.id) {
                const existingAttribution = await db.select().from(referralAttributions).where(eq(referralAttributions.referredInvestorId, data.user.id)).limit(1);
                if (!existingAttribution[0]) {
                  await db.insert(referralAttributions).values({ referrerId: link[0].ownerId, referredInvestorId: data.user.id, linkId: link[0].id, status: 'active' });
                }
              }
            } catch (referralError) {
              console.error('[callback referral attribution]', referralError);
            }
          }
          try { void sendWelcomeEmail(data.user.id).catch(welcomeError => console.error('[callback welcome email]', welcomeError)); } catch (welcomeError) { console.error('[callback welcome email]', welcomeError); }
          if (rows[0]?.twoFactorEnabled) {
            const response = NextResponse.redirect(new URL('/verify-2fa', requestUrl.origin));
            response.cookies.set('qv_2fa_pending', '1', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' });
            return response;
          }
        } catch { /* fall through */ }
      }
    }
  }
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
