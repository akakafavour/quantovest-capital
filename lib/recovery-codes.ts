import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { recoveryCodes } from "@/db/schema";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_COUNT = 10;

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let result = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "");
}

function getPepper(): string {
  return process.env.RECOVERY_CODE_PEPPER?.trim() ?? "";
}

/**
 * HMAC-SHA256 hash of a recovery code.
 *
 * - The server-side `RECOVERY_CODE_PEPPER` is the HMAC key, so stolen hashes
 *   cannot be brute-forced offline without the pepper.
 * - `userId` acts as a per-user salt / domain separator: identical codes for
 *   different users hash differently.
 * - Without a pepper (legacy/dev), falls back to plain SHA-256 so previously
 *   issued codes keep verifying; configure the pepper in prod to harden new
 *   codes. Full per-code random salts need a schema migration (new column),
 *   intentionally deferred in this batch.
 */
export function hashCode(code: string, userId?: string): string {
  const normalized = normalizeCode(code);
  const pepper = getPepper();
  if (pepper) {
    return createHmac("sha256", pepper)
      .update(userId ? `${userId}:${normalized}` : normalized)
      .digest("hex");
  }
  return createHash("sha256").update(normalized).digest("hex");
}

/** Legacy unsalted/unpeppered SHA-256, kept so pre-hardening codes verify. */
function legacyHash(code: string): string {
  return createHash("sha256").update(normalizeCode(code)).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  try {
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

export async function generateRecoveryCodes(userId: string): Promise<string[]> {
  const db = getDb();
  if (!db) throw new Error("Database not configured");

  const codes: string[] = [];
  const rows: { codeHash: string }[] = [];

  for (let i = 0; i < CODE_COUNT; i++) {
    const code = generateCode();
    codes.push(code);
    rows.push({ codeHash: hashCode(code, userId) });
  }

  await db.insert(recoveryCodes).values(
    rows.map((r) => ({ userId, codeHash: r.codeHash }))
  );

  return codes;
}

export async function verifyRecoveryCode(
  userId: string,
  code: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const normalized = normalizeCode(code);
  // Candidates in order: current HMAC(userId salt + pepper), pepper-only
  // (codes issued before userId salting, if any), legacy SHA-256 compat.
  const pepper = getPepper();
  const candidates = pepper
    ? [hashCode(normalized, userId), hashCode(normalized)]
    : [legacyHash(normalized)];

  for (const codeHash of candidates) {
    const rows = await db
      .select()
      .from(recoveryCodes)
      .where(
        and(
          eq(recoveryCodes.userId, userId),
          eq(recoveryCodes.codeHash, codeHash),
          isNull(recoveryCodes.usedAt)
        )
      )
      .limit(1);

    if (rows.length === 0) continue;

    // Re-compare in constant time to avoid leaking prefix matches via timing.
    if (!safeEqualHex(rows[0].codeHash, codeHash)) continue;

    await db
      .update(recoveryCodes)
      .set({ usedAt: new Date() })
      .where(eq(recoveryCodes.id, rows[0].id));

    return true;
  }

  return false;
}

export async function getUnusedRecoveryCodes(
  userId: string
): Promise<string[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select({ codeHash: recoveryCodes.codeHash })
    .from(recoveryCodes)
    .where(
      and(
        eq(recoveryCodes.userId, userId),
        isNull(recoveryCodes.usedAt)
      )
    );

  return rows.map((r) => r.codeHash);
}
