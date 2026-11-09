import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Keep-alive endpoint invoked on a recurring schedule (e.g. via Vercel Cron every 3 days)
 * to prevent Supabase free tier projects from automatically pausing due to inactivity.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: {
    timestamp: string;
    supabaseAuth: boolean;
    database: boolean;
    error?: string;
  } = {
    timestamp: new Date().toISOString(),
    supabaseAuth: false,
    database: false,
  };

  // 1. Ping Supabase Auth settings endpoint
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && anonKey) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: anonKey },
        cache: 'no-store',
      });
      results.supabaseAuth = res.ok;
    } catch (err) {
      console.error('[keep-alive] Supabase Auth ping failed:', err);
    }
  }

  // 2. Ping Database to keep connection pool and project storage active
  try {
    const db = getDb();
    if (db) {
      await db.execute(sql`SELECT 1`);
      results.database = true;
    }
  } catch (err) {
    console.error('[keep-alive] Database ping failed:', err);
    results.error = err instanceof Error ? err.message : 'Database ping error';
  }

  const ok = results.supabaseAuth || results.database;
  return NextResponse.json(
    { ok, ...results },
    { status: ok ? 200 : 503 }
  );
}
