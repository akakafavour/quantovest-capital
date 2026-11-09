import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth-helpers';
import { getDb } from '@/lib/db';
import { platformSettings } from '@/db/schema';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  platformName: 'Quantovest Capital',
  supportEmail: 'support@quantovest.com',
  defaultTimezone: 'UTC',
  maintenanceMode: false,
  minimumDepositCents: 150000,
  supportedCurrencies: ['USD', 'BTC', 'USDT'],
};

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  try {
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.settingKey, 'global')).limit(1);
    return NextResponse.json({ ...DEFAULT_SETTINGS, ...(row?.settingValue as object ?? {}) });
  } catch (err) {
    console.error('[admin settings GET]', err);
    return NextResponse.json({ error: 'Settings unavailable' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { identity, error } = await requireAdmin();
  if (error) return error;
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Settings payload is required.' }, { status: 400 });
  const value = {
    platformName: typeof body.platformName === 'string' && body.platformName.trim() ? body.platformName.trim() : DEFAULT_SETTINGS.platformName,
    supportEmail: typeof body.supportEmail === 'string' && body.supportEmail.trim() ? body.supportEmail.trim() : DEFAULT_SETTINGS.supportEmail,
    defaultTimezone: typeof body.defaultTimezone === 'string' && body.defaultTimezone.trim() ? body.defaultTimezone : DEFAULT_SETTINGS.defaultTimezone,
    maintenanceMode: body.maintenanceMode === true,
    minimumDepositCents: Number.isInteger(body.minimumDepositCents) && body.minimumDepositCents >= 150000 ? body.minimumDepositCents : DEFAULT_SETTINGS.minimumDepositCents,
    supportedCurrencies: Array.isArray(body.supportedCurrencies) ? body.supportedCurrencies.filter((currency: unknown): currency is string => ['USD', 'BTC', 'USDT'].includes(String(currency))) : DEFAULT_SETTINGS.supportedCurrencies,
  };
  try {
    await db.insert(platformSettings).values({ settingKey: 'global', settingValue: value, updatedBy: identity.id }).onConflictDoUpdate({ target: platformSettings.settingKey, set: { settingValue: value, updatedBy: identity.id, updatedAt: new Date() } });
    return NextResponse.json(value);
  } catch (err) {
    console.error('[admin settings PUT]', err);
    return NextResponse.json({ error: 'Settings save failed' }, { status: 500 });
  }
}
