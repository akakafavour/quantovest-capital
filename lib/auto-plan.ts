import { desc, eq, type ExtractTablesWithRelations } from 'drizzle-orm';
import { investorAccounts, plans, portfolioLedger } from '@/db/schema';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof import('@/db/schema'),
  ExtractTablesWithRelations<typeof import('@/db/schema')>
>;

export interface AutoPlanResult {
  changed: boolean;
  fromPlanName: string | null;
  toPlanName: string | null;
}

export async function syncPlanForPrincipal(
  tx: Tx,
  accountId: string,
  investorId: string,
  currentPlanId: number | null,
  principalCents: number,
): Promise<AutoPlanResult> {
  const planRows = await tx.select().from(plans).where(eq(plans.active, 1)).orderBy(desc(plans.minimumDepositCents));
  if (!planRows.length) return { changed: false, fromPlanName: null, toPlanName: null };

  let target: (typeof planRows)[number] | null = null;
  for (const plan of planRows) {
    if (principalCents >= plan.minimumDepositCents) {
      target = plan;
      break;
    }
  }

  if ((target?.id ?? null) === currentPlanId) {
    return { changed: false, fromPlanName: null, toPlanName: null };
  }

  const previous = currentPlanId
    ? await tx.select({ id: plans.id, name: plans.name }).from(plans).where(eq(plans.id, currentPlanId)).limit(1)
    : [];
  const previousName = previous[0]?.name ?? null;

  await tx.update(investorAccounts).set({ planId: target?.id ?? null, updatedAt: new Date() }).where(eq(investorAccounts.id, accountId));

  if (target) {
    await tx.insert(portfolioLedger).values({
      investorId,
      type: 'plan_upgrade',
      amountCents: 0,
      referenceId: `plan-auto-${investorId}-${target.id}-${crypto.randomUUID()}`,
      description: `Account upgraded to the ${target.name} plan`,
    });
  } else {
    await tx.insert(portfolioLedger).values({
      investorId,
      type: 'plan_unassigned',
      amountCents: 0,
      referenceId: `plan-remove-${investorId}-${crypto.randomUUID()}`,
      description: 'Plan removed: account total deposit is below the minimum for any plan',
    });
  }

  return { changed: true, fromPlanName: previousName, toPlanName: target?.name ?? null };
}
