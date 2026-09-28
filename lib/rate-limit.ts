import "server-only";
import { getDb } from "@/lib/db";

/**
 * Shared rate limiter for auth endpoints.
 *
 * DB-BACKED STUB: the interface is keyed for a persistent store (a future
 * `rate_limits` table or Redis), but this batch ships a single-instance
 * in-memory fallback so behaviour is correct on one server without a
 * migration. Multi-instance prod deployments must back this with shared
 * storage; until then, counts are per-instance.
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

// Lazily created so importing this module never throws at build time.
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

  // Attempt a DB-backed path when a database is configured. There is no
  // rate_limits table in this batch (migration deferred), so this probes
  // for one and falls back to memory when absent — keeping the call sites
  // DB-ready without breaking prod.
  try {
    const db = getDb();
    if (db) {
      // No-op probe: if a future migration adds the table, wire the
      // increment/select here. Intentionally silent on failure.
      void db;
    }
  } catch {
    // Fall through to memory buckets.
  }

  const store = buckets();
  const current = store.get(key);
  if (!current || now - current.windowStarted >= windowMs) {
    store.set(key, { count: 0, windowStarted: now });
    return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts };
  }
  if (current.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((current.windowStarted + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds), remaining: 0 };
  }
  return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts - current.count };
}

export async function recordAuthFailure(key: string, windowMs: number = WINDOW_MS): Promise<void> {
  const now = Date.now();
  const store = buckets();
  const current = store.get(key);
  if (!current || now - current.windowStarted >= windowMs) {
    store.set(key, { count: 1, windowStarted: now });
  } else {
    current.count += 1;
  }
}

export async function clearAuthFailures(key: string): Promise<void> {
  buckets().delete(key);
}
