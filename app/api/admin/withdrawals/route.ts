import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth-helpers';
import { notifyAdmins, notifyUser } from '@/lib/notifications';
import { getDb } from '@/lib/db';
import { investorAccounts, investorWithdrawals, portfolioLedger, users } from '@/db/schema';
import { sendWithdrawalApproved, sendWithdrawalRejected } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { identity, error } = await requireAdmin();
    if (error) return error;
    const db = getDb();
    if (!db) return NextResponse.json([]);
    const rows = await db.select({ withdrawal: investorWithdrawals, investorName: users.name, investorEmail: users.email, accountStatus: investorAccounts.status })
      .from(investorWithdrawals)
      .leftJoin(users, eq(investorWithdrawals.investorId, users.id))
      .leftJoin(investorAccounts, eq(investorWithdrawals.investorId, investorAccounts.investorId))
      .orderBy(desc(investorWithdrawals.createdAt));
    return NextResponse.json(rows.map(row => ({ ...row.withdrawal, investorName: row.investorName, investorEmail: row.investorEmail, accountStatus: row.accountStatus ?? null })));
  } catch (err) {
    console.error('[withdrawals]', err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { identity, error } = await requireAdmin();
    if (error) return error;
    const db = getDb();
    if (!db) return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    const body = await request.json().catch(() => null) as { withdrawalId?: number; action?: 'approve' | 'reject'; reviewNote?: string } | null;
    if (!body?.withdrawalId || (body.action !== 'approve' && body.action !== 'reject')) return NextResponse.json({ error: 'Withdrawal and action are required.' }, { status: 400 });
    try {
    let investorId: string | null = null;
    let amountCents = 0;
    let accountClosed = false;
    await db.transaction(async tx => {
      const rows = await tx.select().from(investorWithdrawals).where(and(eq(investorWithdrawals.id, body.withdrawalId!), eq(investorWithdrawals.status, 'pending'))).limit(1);
      if (!rows[0]) throw new Error('Pending withdrawal was not found.');
      const withdrawal = rows[0];
      investorId = withdrawal.investorId;
      amountCents = withdrawal.amountCents;
      const status = body.action === 'approve' ? 'approved' : 'rejected';
      await tx.update(investorWithdrawals).set({ status, reviewedBy: identity.id, reviewNote: body.reviewNote?.trim() || null }).where(eq(investorWithdrawals.id, withdrawal.id));
      const accounts = await tx.select().from(investorAccounts).where(eq(investorAccounts.investorId, withdrawal.investorId)).limit(1);
      const account = accounts[0];
      if (body.action === 'approve') {
        // A withdrawal on an account flagged 'closing' is an account-closure request.
        if (account && account.status === 'closing') {
          await tx.update(investorAccounts).set({ status: 'closed', planId: null, principalCents: 0 }).where(eq(investorAccounts.id, account.id));
          await tx.insert(portfolioLedger).values({ investorId: withdrawal.investorId, type: 'adjustment', amountCents: 0, referenceId: `investor-account-closed:${withdrawal.id}`, description: 'Investor account closed after approved close-account withdrawal' });
          accountClosed = true;
        }
      } else {
        if (account && (account.status === 'active' || account.status === 'closing')) {
          await tx.update(investorAccounts).set({
            balanceCents: account.balanceCents + withdrawal.amountCents,
            ...(account.status === 'closing' ? { status: 'active' as const } : {}),
          }).where(eq(investorAccounts.id, account.id));
        }
        await tx.insert(portfolioLedger).values({ investorId: withdrawal.investorId, type: 'adjustment', amountCents: withdrawal.amountCents, referenceId: `investor-withdrawal-reversal:${withdrawal.id}`, description: `Rejected withdrawal of $${(withdrawal.amountCents / 100).toFixed(2)} — balance released` });
      }
    });
    if (investorId) {
      const dollars = (amountCents / 100).toFixed(2);
      if (body.action === 'approve') {
        await notifyUser(investorId, 'withdrawal_approved', accountClosed ? 'Account closed' : 'Withdrawal processed', accountClosed ? `Your account-closure request was approved. $${dollars} has been processed and your account is now closed.` : `Your withdrawal of $${dollars} has been processed.`);
      } else {
        await notifyUser(investorId, 'withdrawal_rejected', 'Withdrawal declined', `Your withdrawal of $${dollars} was declined. ${body.reviewNote?.trim() || ''}`.trim());
      }
      await notifyAdmins(`withdrawal_${body.action === 'approve' ? 'approved' : 'rejected'}`, accountClosed ? 'Account closed' : `Withdrawal ${body.action}`, accountClosed ? `Withdrawal #${body.withdrawalId} was approved and the investor account was closed.` : `Withdrawal #${body.withdrawalId} was ${body.action} by admin.`);
      try {
        const investor = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, investorId)).limit(1);
        if (investor[0]?.email) {
          const dollars = (amountCents / 100).toFixed(2);
          if (body.action === 'approve') sendWithdrawalApproved(investor[0].email, investor[0].name || 'Investor', `$${dollars}`);
          else sendWithdrawalRejected(investor[0].email, investor[0].name || 'Investor', body.reviewNote?.trim() || 'Withdrawal request was declined.');
        }
      } catch {}
    }
    return NextResponse.json({ updated: true, accountClosed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Withdrawal settlement failed.' }, { status: 400 });
  }
  } catch (err) {
    console.error('[withdrawals PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
