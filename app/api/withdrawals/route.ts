import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getCurrentIdentity } from '@/lib/supabase/identity';
import { getDb } from '@/lib/db';
import { databaseUnavailable } from '@/lib/api-errors';
import { investorAccounts, investorWithdrawals, portfolioLedger, users } from '@/db/schema';
import { notifyAdmins, notifyUser } from '@/lib/notifications';
import { sendWithdrawalSubmitted } from '@/lib/email';
import { verifyTOTP } from '@/lib/totp';

export const dynamic = 'force-dynamic';

const MIN_WITHDRAW_BALANCE_CENTS = 300_000;

export async function GET() {
  try {
    const actor = await getCurrentIdentity();
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = getDb();
    if (!db) return databaseUnavailable('withdrawals GET');
    return NextResponse.json(await db.select().from(investorWithdrawals).where(eq(investorWithdrawals.investorId, actor.id)));
  } catch (err) {
    return databaseUnavailable('withdrawals GET', err);
  }
}

export async function POST(request: Request) {
  const actor = await getCurrentIdentity();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  if (!db) return databaseUnavailable('withdrawals POST');
  const body = await request.json().catch(() => null) as { amountCents?: number; destinationType?: 'bank' | 'crypto'; destination?: string; totpCode?: string; closeAccount?: boolean } | null;
  if (!body?.amountCents || !Number.isInteger(body.amountCents) || body.amountCents <= 0 || (body.destinationType !== 'bank' && body.destinationType !== 'crypto') || !body.destination?.trim()) return NextResponse.json({ error: 'A valid amount and bank or crypto destination are required.' }, { status: 400 });
  // Server-side 2FA: the code is verified here against the stored secret.
  // The secret itself is never exposed to the browser.
  const [twoFactor] = await db.select({ enabled: users.twoFactorEnabled, secret: users.twoFactorSecret }).from(users).where(eq(users.id, actor.id)).limit(1);
  if (twoFactor?.enabled) {
    const code = typeof body.totpCode === 'string' ? body.totpCode.trim() : '';
    if (!twoFactor.secret || !(await verifyTOTP(twoFactor.secret, code))) {
      return NextResponse.json({ error: 'Two-factor verification failed. Enter the 6-digit code from your authenticator app.' }, { status: 403 });
    }
  }
  const closeAccount = body.closeAccount === true;
  try {
    const withdrawalId = await db.transaction(async tx => {
      const accounts = await tx.select().from(investorAccounts).where(and(eq(investorAccounts.investorId, actor.id), eq(investorAccounts.status, 'active'))).limit(1).for('update');
      if (!accounts[0]) throw new Error('No active investor account found.');
      if (accounts[0].balanceCents < MIN_WITHDRAW_BALANCE_CENTS) throw new Error('A minimum balance of $3,000 is required to withdraw.');
      if (accounts[0].balanceCents < body.amountCents!) throw new Error('Insufficient available balance.');
      if (closeAccount && body.amountCents! !== accounts[0].balanceCents) throw new Error('Close-account withdrawals must equal your full available balance.');
      await tx.update(investorAccounts).set({
        balanceCents: accounts[0].balanceCents - body.amountCents!,
        ...(closeAccount ? { status: 'closing' as const } : {}),
      }).where(eq(investorAccounts.id, accounts[0].id));
      const inserted = await tx.insert(investorWithdrawals).values({ investorId: actor.id, amountCents: body.amountCents!, destinationType: body.destinationType!, destination: body.destination!.trim(), status: 'pending' }).returning({ id: investorWithdrawals.id });
      await tx.insert(portfolioLedger).values({ investorId: actor.id, type: 'withdrawal', amountCents: -body.amountCents!, referenceId: `investor-withdrawal:${inserted[0].id}`, description: closeAccount ? 'Close-account withdrawal request held for admin review' : 'Investor withdrawal request held for admin review' });
      return inserted[0].id;
    });
    const dollars = (body.amountCents! / 100).toFixed(2);
    await notifyUser(actor.id, 'withdrawal_submitted', closeAccount ? 'Account closure requested' : 'Withdrawal requested', closeAccount ? `Your request to close your account and withdraw $${dollars} has been submitted and is pending review.` : `Your withdrawal request of $${dollars} has been submitted and is pending review.`);
    await notifyAdmins('withdrawal_submitted', closeAccount ? 'New account-closure request' : 'New withdrawal request', closeAccount ? `${actor.name || actor.id} requested to close their account (withdraw $${dollars}).` : `A withdrawal request of $${dollars} was submitted by ${actor.name || actor.id}.`);
    try { if (actor.email) void sendWithdrawalSubmitted(actor.email, actor.name || 'Investor', `$${dollars}`).catch(error => console.error('[withdrawal email]', error)); } catch {}
    return NextResponse.json({ withdrawalId, status: 'pending' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Withdrawal request failed.' }, { status: 400 });
  }
}
