import { NextResponse } from 'next/server';
import { getCurrentIdentity } from '@/lib/supabase/identity';

export const dynamic = 'force-dynamic';

export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ id: identity.id, email: identity.email, role: identity.role });
}
