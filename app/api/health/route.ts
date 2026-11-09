import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: {
      database: { status: 'up' | 'down' | 'unconfigured'; latencyMs?: number; error?: string };
      supabaseAuth: { status: 'up' | 'down' | 'unconfigured'; latencyMs?: number };
    };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unconfigured' },
      supabaseAuth: { status: 'unconfigured' },
    },
  };

  // Test Supabase Auth
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && anonKey) {
    const start = Date.now();
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: anonKey },
        cache: 'no-store',
      });
      health.services.supabaseAuth = {
        status: res.ok ? 'up' : 'down',
        latencyMs: Date.now() - start,
      };
    } catch {
      health.services.supabaseAuth = { status: 'down', latencyMs: Date.now() - start };
    }
  }

  // Test Database
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbUrl && !dbUrl.includes('<FILL')) {
    const start = Date.now();
    try {
      const db = getDb();
      if (db) {
        await db.execute(sql`SELECT 1`);
        health.services.database = { status: 'up', latencyMs: Date.now() - start };
      } else {
        health.services.database = { status: 'down', latencyMs: Date.now() - start };
      }
    } catch (err) {
      health.services.database = {
        status: 'down',
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  const isDegraded =
    health.services.supabaseAuth.status === 'down' ||
    health.services.database.status === 'down';

  health.status = isDegraded ? 'degraded' : 'healthy';

  return NextResponse.json(health, { status: isDegraded ? 503 : 200 });
}
