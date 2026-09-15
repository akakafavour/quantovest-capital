import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentIdentity } from '@/lib/supabase/identity';
import { notifyAdmins } from '@/lib/notifications';
import { getDb } from '@/lib/db';
import { deposits, investorAccounts, users } from '@/db/schema';
import { sendDepositSubmitted } from '@/lib/email';
import { databaseUnavailable } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await getCurrentIdentity();
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = getDb();
    if (!db) return databaseUnavailable('deposits GET');
    return NextResponse.json(await db.select().from(deposits).where(eq(deposits.investorId, actor.id)));
  } catch (err) {
    return databaseUnavailable('deposits GET', err);
  }
}

export async function POST(request: Request) {
  const actor = await getCurrentIdentity();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  if (!db) return databaseUnavailable('deposits POST');
  try {
    const body = await request.json().catch(() => null) as { amountCents?: number; method?: string; proofPath?: string; planId?: number | null } | null;
    if (!body?.amountCents || !Number.isInteger(body.amountCents) || body.amountCents < 5000 || !['usdt-trc20', 'btc'].includes(body.method || '') || !body.proofPath?.trim()) return NextResponse.json({ error: 'Minimum deposit is $50. Select a valid cryptocurrency and upload proof.' }, { status: 400 });
    if (!body.proofPath.startsWith(`deposit-proof/${actor.id}/`)) return NextResponse.json({ error: 'Deposit proof is invalid or expired. Please upload it again.' }, { status: 400 });
    const [account] = await db.select({ status: investorAccounts.status }).from(investorAccounts).where(eq(investorAccounts.investorId, actor.id)).limit(1);
    if (account && account.status !== 'active') return NextResponse.json({ error: 'Your account is closing. New deposits are disabled.' }, { status: 400 });
    const id = crypto.randomUUID();
    await db.insert(deposits).values({ id, investorId: actor.id, amountCents: body.amountCents, method: body.method!, proofPath: body.proofPath.trim(), planId: body.planId ?? null, status: 'pending' });
    try {
      await notifyAdmins('deposit_submitted', 'New deposit awaiting verification', `Investor ${actor.id} submitted a $${(body.amountCents / 100).toFixed(2)} deposit via ${body.method}.`);
      if (actor.email) {
        const investor = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, actor.id)).limit(1);
        if (investor[0]?.email) sendDepositSubmitted(investor[0].email, investor[0].name || 'Investor', `$${(body.amountCents / 100).toFixed(2)}`);
      }
    } catch (notificationError) {
      console.error('[deposits] notification delivery failed', notificationError instanceof Error ? notificationError.message : 'unknown');
    }
    return NextResponse.json({ id, status: 'pending' }, { status: 201 });
  } catch (err) {
    return databaseUnavailable('deposits POST', err);
  }
}
