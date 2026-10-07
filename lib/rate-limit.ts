import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rateLimits } from "@/db/schema";

/**
 * DB-backed rate limiter for auth endpoints.
 *
 * Uses the `rateLimits` table for shared state across all serverless instances.
 * Falls back to in-memory when the database is unavailable (e.g. local dev).
 *
 * Usage:
 *   const { allowed, retryAfterSeconds } = await checkAuthRateLimit(`2fa:${userId}`);
 *   if (!allowed) return NextResponse.json({ error: 'Too many attempts…' }, {
 *     status: 429, headers: { 'Retry-After': String(retryAfterSeconds) },
 *   });
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = { count: number; windowStarted: number };

// In-memory fallback for when DB is unavailable.
let memoryBuckets: Map<string, Bucket> | null = null;
function buckets(): Map<string, Bucket> {
  if (!memoryBuckets) memoryBuckets = new Map<string, Bucket>();
  return memoryBuckets;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the client must wait before retrying (0 when allowed). */
  retryAfterSeconds: number;
  remaining: number;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  if (result.allowed) return {};
  return { "Retry-After": String(Math.max(1, result.retryAfterSeconds)) };
}

export async function checkAuthRateLimit(
  key: string,
  opts?: { maxAttempts?: number; windowMs?: number },
): Promise<RateLimitResult> {
  const maxAttempts = opts?.maxAttempts ?? MAX_ATTEMPTS;
  const windowMs = opts?.windowMs ?? WINDOW_MS;
  const now = Date.now();

  // Try DB-backed path first.
  try {
    const db = getDb();
    if (db) {
      return await db.transaction(async tx => {
        const existing = await tx.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
        const current = existing[0];

        if (!current || now - new Date(current.windowStarted).getTime() >= windowMs) {
          // Window expired or never existed — reset.
          await tx.insert(rateLimits).values({ key, count: 1, windowStarted: new Date(now) })
            .onConflictDoUpdate({
              target: rateLimits.key,
              set: { count: 1, windowStarted: new Date(now) },
            });
          return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts - 1 };
        }

        if (current.count >= maxAttempts) {
          const elapsed = now - new Date(current.windowStarted).getTime();
          const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
          return { allowed: false, retryAfterSeconds, remaining: 0 };
        }

        await tx.update(rateLimits).set({ count: current.count + 1 }).where(eq(rateLimits.key, key));
        return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts - current.count - 1 };
      });
    }
  } catch {
    // Fall through to memory buckets.
  }

  // In-memory fallback.
  const store = buckets();
  const current = store.get(key);
  if (!current || now - current.windowStarted >= windowMs) {
    store.set(key, { count: 1, windowStarted: now });
    return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts - 1 };
  }
  if (current.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((current.windowStarted + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds), remaining: 0 };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts - current.count };
}

export async function recordAuthFailure(key: string, windowMs: number = WINDOW_MS): Promise<void> {
  const now = Date.now();

  try {
    const db = getDb();
    if (db) {
      const existing = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
      if (!existing[0] || now - new Date(existing[0].windowStarted).getTime() >= windowMs) {
        await db.insert(rateLimits).values({ key, count: 1, windowStarted: new Date(now) })
          .onConflictDoUpdate({
            target: rateLimits.key,
            set: { count: 1, windowStarted: new Date(now) },
          });
      } else {
        await db.update(rateLimits).set({ count: existing[0].count + 1 }).where(eq(rateLimits.key, key));
      }
      return;
    }
  } catch {
    // Fall through to memory.
  }

  const store = buckets();
  const current = store.get(key);
  if (!current || now - current.windowStarted >= windowMs) {
    store.set(key, { count: 1, windowStarted: now });
  } else {
    current.count += 1;
  }
}

export async function clearAuthFailures(key: string): Promise<void> {
  try {
    const db = getDb();
    if (db) {
      await db.delete(rateLimits).where(eq(rateLimits.key, key));
      return;
    }
  } catch {
    // Fall through to memory.
  }
  buckets().delete(key);
}
