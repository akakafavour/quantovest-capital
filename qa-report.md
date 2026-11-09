# Security Audit Report — Quantovest Capital

**Date:** 2026-10-07  
**Scope:** Full codebase audit (Next.js 14 + Supabase Auth + Drizzle ORM)  
**Auditor:** Security Agent  

---

## Executive Summary

Quantovest Capital is a Next.js 14 investment platform handling real money and KYC PII. This audit identified **2 CRITICAL**, **6 HIGH**, **10 MEDIUM**, and **6 LOW** severity findings. The most urgent issues are a privilege escalation vulnerability in role determination and a fail-open 2FA enforcement gap in middleware.

---

## CRITICAL Findings

### C-1: Privilege Escalation via app_metadata Role

**Location:** `lib/supabase/identity.ts:43`  
**Risk:** An attacker who can set their own `app_metadata.role` to `"admin"` (via Supabase dashboard misconfiguration, compromised service key, or OAuth provider metadata mapping) will be granted full admin access. The role determination uses OR logic: `authRole === 'admin' || dbRole === 'admin'`, meaning either source alone can grant admin.  
**Fix:** Require BOTH sources to agree for admin role, or use only the database role (which is server-controlled). Remove `app_metadata.role` from the admin determination logic:
```typescript
const dbRole = profile[0]?.role === 'admin' ? 'admin' : 'investor';
return { ..., role: dbRole, ... };
```

### C-2: 2FA Enforcement is Fail-Open in Middleware

**Location:** `middleware.ts:96-103`  
**Risk:** The middleware only enforces 2FA when the `qv_2fa_pending` cookie is set. This cookie is set by the client calling `/api/auth/2fa` with `action: 'challenge'`. If the client never calls this endpoint (or the cookie is deleted), the middleware never enforces 2FA — even for users with 2FA enabled. An attacker with a stolen session cookie can bypass 2FA entirely.  
**Fix:** Check the database for `twoFactorEnabled` on every authenticated request, not just when the pending cookie is set:
```typescript
if (isAuthenticated && pathname !== '/verify-2fa' && !pathname.startsWith('/api/auth/2fa')) {
  const db = getDb();
  if (db) {
    const [user] = await db.select({ twoFactorEnabled: users.twoFactorEnabled })
      .from(users).where(eq(users.id, user.id)).limit(1);
    if (user?.twoFactorEnabled) {
      const verified = await verifyTwoFactorToken(
        request.cookies.get('qv_2fa_verified')?.value, user.id
      ).catch(() => false);
      if (!verified) {
        // redirect to /verify-2fa
      }
    }
  }
}
```

---

## HIGH Findings

### H-1: Withdrawal Approval Missing Row Lock (TOCTOU Race)

**Location:** `app/api/admin/withdrawals/route.ts:42`  
**Risk:** The withdrawal approval transaction does NOT use `.for('update')` to lock the withdrawal row. Two concurrent approval requests could both read the same pending withdrawal, both approve it, and both credit the investor — resulting in double payment. Compare with deposit approval (`app/api/admin/deposits/route.ts:55`) which correctly uses `.for('update')`.  
**Fix:** Add `.for('update')` to the withdrawal select:
```typescript
const rows = await tx.select().from(investorWithdrawals)
  .where(and(eq(investorWithdrawals.id, body.withdrawalId!), eq(investorWithdrawals.status, 'pending')))
  .limit(1).for('update');
```

### H-2: TOTP Verification Lacks Timing-Safe Comparison

**Location:** `lib/totp.ts:116`  
**Risk:** The TOTP verification uses `===` to compare the computed code with the user-provided code. This is vulnerable to timing attacks that could leak the correct code byte-by-byte. While the attack is difficult over a network, it violates cryptographic best practices.  
**Fix:** Use a constant-time comparison:
```typescript
function safeEqual(a: number, b: number): boolean {
  // Constant-time comparison for 6-digit codes
  let diff = 0;
  const aStr = a.toString().padStart(6, '0');
  const bStr = b.toString().padStart(6, '0');
  for (let i = 0; i < 6; i++) {
    diff |= aStr.charCodeAt(i) ^ bStr.charCodeAt(i);
  }
  return diff === 0;
}
```

### H-3: TOTP Has No Replay Protection

**Location:** `lib/totp.ts:105-119`  
**Risk:** A valid TOTP code can be reused within the 30-second window (or the -1/+1 window). If an attacker intercepts a code (e.g., via phishing or malware), they can replay it before the window expires.  
**Fix:** Track used TOTP codes in the database or cache. Add a `usedTotpCodes` table or use Redis to store `userId:code` pairs with a 60-second TTL, and reject any code that has been seen before.

### H-4: Recovery Code Legacy Fallback Uses Unsalted SHA-256

**Location:** `lib/recovery-codes.ts:48,52-54`  
**Risk:** When `RECOVERY_CODE_PEPPER` is not set, recovery codes are hashed with plain unsalted SHA-256. This allows offline brute-force attacks if the database is compromised. The `.env.example` documents this as required for production, but the code silently falls back to the weak hash.  
**Fix:** Remove the legacy fallback in production. Throw an error if the pepper is not configured:
```typescript
if (!pepper && process.env.NODE_ENV === 'production') {
  throw new Error('RECOVERY_CODE_PEPPER must be set in production.');
}
```

### H-5: Database TLS Certificate Verification Disabled for Supabase Pooler

**Location:** `lib/db.ts:31-32`  
**Risk:** When connecting through Supabase's PgBouncer pooler, `rejectUnauthorized: false` disables TLS certificate verification. This makes the connection vulnerable to man-in-the-middle attacks, potentially exposing all database credentials and data in transit.  
**Fix:** Use the Supabase pooler's CA certificate for verification, or use a direct connection (port 5432) in production where full certificate verification is possible:
```typescript
ssl: url.includes('localhost')
  ? false
  : /\.pooler\.supabase\.com$/.test(hostname)
    ? { rejectUnauthorized: true, ca: process.env.SUPABASE_POOLER_CA_CERT }
    : { rejectUnauthorized: true }
```

### H-6: No Rate Limiting on Financial Transaction Endpoints

**Location:** `app/api/deposits/route.ts`, `app/api/withdrawals/route.ts`, `app/api/swap/execute/route.ts`  
**Risk:** Deposit submission, withdrawal submission, and swap execution have no rate limiting. An attacker could spam these endpoints to create excessive load, manipulate prices (in the case of swaps), or attempt to exploit race conditions.  
**Fix:** Add rate limiting to all financial endpoints:
```typescript
const limit = await checkAuthRateLimit(`deposit:${actor.id}`, { maxAttempts: 10, windowMs: 60000 });
if (!limit.allowed) {
  return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
}
```

---

## MEDIUM Findings

### M-1: CSP Allows 'unsafe-inline' and 'unsafe-eval' for Scripts

**Location:** `next.config.js:20`  
**Risk:** The Content-Security-Policy allows `'unsafe-inline'` and `'unsafe-eval'` for scripts, which significantly weakens XSS protection. An attacker who can inject inline scripts can bypass CSP.  
**Fix:** Use nonces or hashes for inline scripts. Next.js supports `next/script` with `strategy="afterInteractive"` which can be configured with nonces. Remove `'unsafe-eval'` if possible.

### M-2: Audit Logging is Console-Only and Inconsistent

**Location:** `lib/audit.ts:26`  
**Risk:** Audit events are only logged to `console.log`, which is ephemeral and not queryable. Only 3 operations (plan create, plan update, plan assign) use audit logging. Critical operations like deposit approval, withdrawal approval, balance credit, and swap execution have no audit trail.  
**Fix:** Persist audit events to a database table and add logging to all financial operations:
```typescript
await db.insert(auditLog).values({
  actorId, action, targetType, targetId, details, timestamp: new Date()
});
```

### M-3: Error Messages May Leak Internal Details

**Location:** `app/api/admin/investors/route.ts:31`, `app/api/admin/settings/route.ts:27,50`, `app/api/admin/plans/route.ts:55,92`  
**Risk:** Several routes return `err.message` directly to the client, which could leak database schema details, stack traces, or internal service names.  
**Fix:** Return generic error messages to clients and log detailed errors server-side:
```typescript
console.error('[route]', err);
return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
```

### M-4: CSV Formula Injection in History Export

**Location:** `app/api/history/export/route.ts:23-29`  
**Risk:** The CSV export does not sanitize for formula injection. If a description or reference ID starts with `=`, `+`, `-`, or `@`, it could be interpreted as a formula when opened in Excel, potentially executing malicious code.  
**Fix:** Sanitize CSV fields:
```typescript
const sanitizeCsv = (value: string) => {
  if (/^[=+\-@]/.test(value)) return `'${value}`;
  return value;
};
```

### M-5: File Upload Validates MIME Type but Not Content

**Location:** `app/api/uploads/route.ts:27`  
**Risk:** The upload route validates the MIME type provided by the client but does not verify the actual file content. An attacker could upload a malicious file (e.g., an HTML file with JavaScript) with a `image/jpeg` MIME type.  
**Fix:** Use a library like `file-type` to verify the actual file content matches the declared MIME type.

### M-6: Rate Limiter is In-Memory Only (Not Shared Across Instances)

**Location:** `lib/rate-limit.ts:26-30`  
**Risk:** The rate limiter uses in-memory storage, which means it only works on a single server instance. In a multi-instance deployment (e.g., Vercel serverless), each instance has its own rate limit state, making it trivial to bypass.  
**Fix:** Use a shared store like Redis or a database table for rate limit state.

### M-7: No Rate Limiting on Admin Actions

**Location:** `app/api/admin/deposits/route.ts`, `app/api/admin/withdrawals/route.ts`, `app/api/admin/balance/route.ts`, `app/api/admin/assign-plan/route.ts`  
**Risk:** Admin actions that move money (approve deposits, approve withdrawals, credit balances, assign plans) have no rate limiting. A compromised admin account could be used to rapidly drain funds.  
**Fix:** Add rate limiting to all admin financial operations.

### M-8: 2FA Session Token Has No Replay Protection

**Location:** `lib/2fa-session.ts:26-30`  
**Risk:** Once a 2FA verified token is issued, it is valid for 1 hour. If an attacker steals this cookie, they can use it for up to an hour without needing the TOTP code again.  
**Fix:** Implement token rotation or shorter TTLs. Consider binding the token to the user's IP address or user agent.

### M-9: No HTTPS Enforcement in Middleware

**Location:** `middleware.ts`  
**Risk:** The middleware does not enforce HTTPS. While the CSP includes `upgrade-insecure-requests`, this is not a substitute for server-side HTTPS enforcement.  
**Fix:** Add HTTPS enforcement at the middleware level:
```typescript
if (process.env.NODE_ENV === 'production' && request.headers.get('x-forwarded-proto') !== 'https') {
  return NextResponse.redirect(new URL(`https://${request.headers.get('host')}${pathname}`));
}
```

### M-10: Push Subscription Endpoint Not Validated

**Location:** `app/api/push/subscribe/route.ts:22-24`  
**Risk:** The push subscription endpoint accepts any endpoint URL without validation. An attacker could subscribe arbitrary endpoints, potentially causing abuse of the push notification service.  
**Fix:** Validate that the endpoint is a valid HTTPS URL from a known push service:
```typescript
if (!body.endpoint.startsWith('https://')) {
  return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
}
```

---

## LOW Findings

### L-1: TOTP Secret Stored in Plaintext in Database

**Location:** `db/schema.ts:14` (`twoFactorSecret` column)  
**Risk:** The TOTP secret is stored in plaintext in the database. If the database is compromised, an attacker can generate valid TOTP codes for any user.  
**Fix:** Encrypt the TOTP secret at rest using a server-side encryption key.

### L-2: No Content Security Policy for API Responses

**Location:** `next.config.js`  
**Risk:** The CSP header is applied to all routes including API responses, but API responses are JSON and don't need CSP. This is not a vulnerability but is unnecessary.  
**Fix:** Consider excluding API routes from CSP headers.

### L-3: Referral Code Predictable Format

**Location:** `app/api/referrals/link/route.ts:32`  
**Risk:** Referral codes use a predictable format (`QV-` + 10 hex chars). While the entropy is sufficient (40 bits), the format makes it easy to identify and enumerate.  
**Fix:** Use a longer, more random code format.

### L-4: No Request Size Limit on JSON Bodies

**Location:** All API routes  
**Risk:** Next.js has a default body size limit (1MB for API routes), but this is not explicitly configured. An attacker could send large JSON payloads to cause memory exhaustion.  
**Fix:** Explicitly configure body size limits in `next.config.js`.

### L-5: Missing Security Headers on Error Pages

**Location:** `next.config.js`  
**Risk:** The security headers are applied to all routes, but Next.js error pages (404, 500) may not include them.  
**Fix:** Verify that error pages include security headers.

### L-6: No Subresource Integrity (SRI) for External Scripts

**Location:** `next.config.js`  
**Risk:** External scripts (e.g., Tawk.to widget) are loaded without Subresource Integrity, making them vulnerable to supply chain attacks.  
**Fix:** Add SRI hashes for all external scripts.

---

## Positive Security Observations

1. **Parameterized Queries:** All database queries use Drizzle ORM with parameterized queries. The one raw SQL query (`app/api/admin/investors/route.ts`) correctly uses `$1` parameterization.

2. **Fail-Closed Configuration:** The middleware and Supabase client both fail closed when configuration is missing, returning 503 instead of allowing unauthenticated access.

3. **Transaction Usage:** All financial mutations use database transactions, ensuring atomicity.

4. **Row-Level Locking:** Deposit approval and swap execution correctly use `.for('update')` to prevent race conditions.

5. **Input Validation:** Most API routes validate input bodies with type checking and allowlists.

6. **Security Headers:** Comprehensive security headers are configured including HSTS, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.

7. **Cookie Security:** 2FA cookies use `httpOnly`, `secure` (in production), and `sameSite: 'lax'`.

8. **Password Policy:** Signup enforces a minimum password length of 8 characters.

9. **Referral System:** Uses idempotency keys to prevent duplicate rewards.

10. **Price Feed:** Swap execution uses fail-closed price fetching that throws on stale/missing prices.

---

## Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| P0 (Immediate) | C-1: Privilege Escalation | Low |
| P0 (Immediate) | C-2: 2FA Fail-Open | Medium |
| P1 (This Sprint) | H-1: Withdrawal TOCTOU | Low |
| P1 (This Sprint) | H-2: TOTP Timing Attack | Low |
| P1 (This Sprint) | H-3: TOTP Replay | Medium |
| P1 (This Sprint) | H-4: Recovery Code Fallback | Low |
| P1 (This Sprint) | H-5: DB TLS Verification | Medium |
| P1 (This Sprint) | H-6: Financial Rate Limiting | Medium |
| P2 (Next Sprint) | M-1 through M-10 | Medium-High |
| P3 (Backlog) | L-1 through L-6 | Low |

---

## Conclusion

Quantovest Capital has a solid security foundation with parameterized queries, transactions, and security headers. However, the two CRITICAL findings (privilege escalation and 2FA bypass) must be addressed immediately before handling real money. The HIGH findings should be remediated in the current sprint to prevent financial loss through race conditions and cryptographic weaknesses.
