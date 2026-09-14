import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { desc, eq } from 'drizzle-orm';
import { getCurrentIdentity } from '@/lib/supabase/identity';
import { getDb } from '@/lib/db';
import { users, investorAccounts, plans, roiEntries, kycApplications } from '@/db/schema';

export const dynamic = 'force-dynamic';

type Actor = { id: string; name?: string | null; email: string | null; avatar?: string | null; role: string };

const fallbackProfile = (actor: Actor) => ({
  id: actor.id,
  name: actor.name ?? null,
  email: actor.email,
  avatar: actor.avatar ?? null,
  role: actor.role,
  balance: 0,
  totalInvested: 0,
  totalProfit: 0,
  dailyRoiPercent: 0,
  allTimeRoiPercent: 0,
  plan: '',
  kycStatus: 'unverified',
  onboardingCompleted: false,
  tourCompleted: false,
  payoutDetails: null,
  notificationPrefs: null,
  twoFactorEnabled: false,
  accountStatus: null,
});

async function readSupabaseProfile(actor: Actor) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return fallbackProfile(actor);
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [userResult, accountResult, kycResult] = await Promise.all([
    admin.from('users').select('*').eq('id', actor.id).limit(1).maybeSingle(),
    admin.from('investorAccounts').select('*').eq('investorId', actor.id).limit(1).maybeSingle(),
    admin.from('kycApplications').select('status').eq('investorId', actor.id).order('createdAt', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (userResult.error) console.error('[investor-profile] Supabase user fallback failed', userResult.error.message);
  if (accountResult.error) console.error('[investor-profile] Supabase account fallback failed', accountResult.error.message);
  if (kycResult.error) console.error('[investor-profile] Supabase KYC fallback failed', kycResult.error.message);
  const userRow = userResult.data;
  const account = accountResult.data;
  let planName: string | null = null;
  if (account?.planId) {
    const planResult = await admin.from('plans').select('name').eq('id', account.planId).limit(1).maybeSingle();
    if (planResult.error) console.error('[investor-profile] Supabase plan fallback failed', planResult.error.message);
    planName = planResult.data?.name ?? null;
  }
  const balanceCents = account?.balanceCents ?? 0;
  const principalCents = account?.principalCents ?? 0;
  const balance = balanceCents / 100;
  const totalInvested = principalCents / 100;
  const totalProfit = balance - totalInvested;
  const answers = userRow?.onboardingAnswers;
  return {
    id: userRow?.id ?? actor.id,
    name: userRow?.name || actor.name,
    email: userRow?.email || actor.email,
    avatar: userRow?.image || actor.avatar || null,
    role: actor.role,
    balance,
    totalInvested,
    totalProfit: Number(totalProfit.toFixed(2)),
    dailyRoiPercent: 0,
    allTimeRoiPercent: totalInvested > 0 ? Number((((balance - totalInvested) / totalInvested) * 100).toFixed(2)) : 0,
    plan: planName ?? '',
    kycStatus: kycResult.data?.status ?? 'unverified',
    onboardingCompleted: userRow?.onboardingCompleted ?? false,
    tourCompleted: Boolean(answers && typeof answers === 'object' && (answers as Record<string, unknown>).tourCompleted === true),
    payoutDetails: userRow?.payoutDetails ?? null,
    notificationPrefs: userRow?.notificationPrefs ?? null,
    twoFactorEnabled: userRow?.twoFactorEnabled ?? false,
    accountStatus: (account as { status?: string } | undefined)?.status ?? null,
  };
}

export async function GET() {
  try {
    const actor = await getCurrentIdentity();
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    if (!db) return NextResponse.json(await readSupabaseProfile(actor), { headers: { 'Cache-Control': 'no-store' } });

    try {
      const [userRow] = await db.select().from(users).where(eq(users.id, actor.id)).limit(1);
      if (!userRow) return NextResponse.json(await readSupabaseProfile(actor), { headers: { 'Cache-Control': 'no-store' } });

      let account: typeof investorAccounts.$inferSelect | undefined;
      let latestRoi: any[] = [];
      let latestKyc: typeof kycApplications.$inferSelect | undefined;

      const [accountResult, roiResult, kycResult] = await Promise.allSettled([
        db.select().from(investorAccounts).where(eq(investorAccounts.investorId, actor.id)).limit(1),
        db.select().from(roiEntries).where(eq(roiEntries.investorId, actor.id)).orderBy(desc(roiEntries.entryDate)).limit(1),
        db.select().from(kycApplications).where(eq(kycApplications.investorId, actor.id)).orderBy(desc(kycApplications.createdAt)).limit(1),
      ]);
      if (accountResult.status === 'fulfilled') account = accountResult.value[0];
      if (roiResult.status === 'fulfilled') latestRoi = roiResult.value;
      if (kycResult.status === 'fulfilled') latestKyc = kycResult.value[0];
      if (accountResult.status === 'rejected') console.error('[investor-profile] account query failed', accountResult.reason);
      if (roiResult.status === 'rejected') console.error('[investor-profile] ROI query failed', roiResult.reason);
      if (kycResult.status === 'rejected') console.error('[investor-profile] KYC query failed', kycResult.reason);

      // The SQL Editor and app may use different connection paths. If Drizzle cannot
      // see the row, read the same server-side Supabase database used by Storage.
      if (!account) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceRoleKey) {
          const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data, error } = await admin.from('investorAccounts').select('*').eq('investorId', actor.id).limit(1);
          if (error) console.error('[investor-profile] Supabase account fallback failed', error.message);
          else if (data?.[0]) account = data[0] as typeof investorAccounts.$inferSelect;
        }
      }

      let planName: string | null = null;
      if (account?.planId) {
        try {
          const [plan] = await db.select().from(plans).where(eq(plans.id, account.planId)).limit(1);
          planName = plan?.name ?? null;
        } catch {}
        if (!planName) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (supabaseUrl && serviceRoleKey) {
            const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const { data, error } = await admin.from('plans').select('name').eq('id', account.planId).limit(1);
            if (error) console.error('[investor-profile] Supabase plan fallback failed', error.message);
            else planName = data?.[0]?.name ?? null;
          }
        }
      }

      const balanceCents = account?.balanceCents ?? 0;
      const principalCents = account?.principalCents ?? 0;
      const balance = balanceCents / 100;
      const totalInvested = principalCents / 100;
      const totalProfit = balance - totalInvested;
      const allTimeRoiPercent = totalInvested > 0 ? Number((((balance - totalInvested) / totalInvested) * 100).toFixed(2)) : 0;
      const dailyRoiPercent = latestRoi[0] ? latestRoi[0].percentageBps / 100 : 0;

      return NextResponse.json({
        id: userRow.id,
        name: userRow.name || actor.name,
        email: userRow.email || actor.email,
        avatar: userRow.image || actor.avatar || null,
        role: actor.role,
        balance,
        totalInvested,
        totalProfit: Number(totalProfit.toFixed(2)),
        dailyRoiPercent,
        allTimeRoiPercent,
        plan: planName ?? '',
        kycStatus: latestKyc?.status ?? 'unverified',
        onboardingCompleted: userRow.onboardingCompleted ?? false,
        tourCompleted: Boolean(userRow.onboardingAnswers && typeof userRow.onboardingAnswers === 'object' && (userRow.onboardingAnswers as Record<string, unknown>).tourCompleted === true),
        payoutDetails: userRow.payoutDetails ?? null,
        notificationPrefs: userRow.notificationPrefs ?? null,
        twoFactorEnabled: userRow.twoFactorEnabled ?? false,
        accountStatus: account?.status ?? null,
      });
    } catch (dbErr) {
      console.error('[investor-profile] Drizzle read failed; using Supabase fallback', dbErr);
      return NextResponse.json(await readSupabaseProfile(actor), { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch (err) {
    console.error('[investor-profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
