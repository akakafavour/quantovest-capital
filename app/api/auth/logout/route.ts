import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error('[logout] supabase signOut failed', error instanceof Error ? error.message : error);
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set('qv_2fa_verified', '', { ...cookieOptions, maxAge: 0 });
  response.cookies.set('qv_2fa_pending', '', { ...cookieOptions, maxAge: 0 });
  return response;
}
