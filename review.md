# Quantovest Capital — Code Review Report

**Reviewer:** Reviewer Agent  
**Date:** 2026-10-07  
**Scope:** Code quality, security, test coverage, handoff readiness, red flags  
**Files Reviewed:** 30+ across `lib/`, `app/api/`, `components/`, `db/`, `tests/`, `docs/`

---

## Executive Summary

| Category | Verdict | Notes |
|---|---|---|
| **Code Quality** | **PASS** | Clean, modular, strict TypeScript, small functions |
| **Security** | **WARN** | Strong foundations; rate limiter is in-memory stub, no login rate limit |
| **Test Coverage** | **WARN** | 107 unit tests pass; no integration/E2E; source-pinning pattern is brittle |
| **Handoff Readiness** | **PASS** | Excellent docs, complete .env.example, clear architecture |
| **Red Flags** | **WARN** | A few swallowed catches, console.log in prod audit, no money-path E2E |

**Overall:** The codebase is well-structured and production-minded. The team has clearly done security hardening work (fail-closed middleware, strict redirects, HMAC recovery codes, server-side TOTP). The main gaps are operational: rate limiting is a stub, test coverage is shallow for money paths, and a few error-handling inconsistencies remain.

---

## 1. Code Quality — PASS

### Files Sampled
- `lib/rate-limit.ts`, `lib/api-helpers.ts`, `lib/auth-helpers.ts`, `lib/auth-redirect.ts`, `lib/api-errors.ts`, `lib/db.ts`, `lib/totp.ts`, `lib/2fa-session.ts`, `lib/supabase/identity.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/email.ts`, `lib/notifications.ts`, `lib/audit.ts`, `lib/uploadRules.ts`, `lib/swap-prices.ts`, `lib/referral-reward.ts`, `lib/recovery-codes.ts`, `lib/auto-plan.ts`
- `app/api/deposits/route.ts`, `app/api/withdrawals/route.ts`, `app/api/swap/execute/route.ts`, `app/api/auth/signup/route.ts`, `app/api/auth/2fa/route.ts`, `app/api/kyc/route.ts`, `app/api/admin/deposits/route.ts`, `app/api/admin/withdrawals/route.ts`, `app/api/admin/roi/route.ts`, `app/api/admin/balance/route.ts`, `app/api/admin/assign-plan/route.ts`, `app/api/uploads/route.ts`, `app/api/investor-profile/route.ts`
- `middleware.ts`, `components/KycModal.tsx`, `components/totp-qr.tsx`

### Strengths
- **Function size:** Nearly all functions are under 30 lines. The largest (`swap/execute/route.ts` POST) is ~180 lines but is a single transaction with clear sequential steps.
- **File size:** All files under 250 lines except `lib/email.ts` (488 lines — acceptable given 15 templates + SMTP client).
- **TypeScript strict mode:** Enabled in `tsconfig.json`. No `any` types found in production code (one `any[]` in `investor-profile/route.ts:97` for a query result — minor).
- **Naming:** Consistent, descriptive, verb-first functions, PascalCase components, kebab-case files.
- **No TODOs/FIXMEs** in production code (only in `docs/QA-findings.md` as a future test plan).
- **Modularity:** Clean separation — `lib/` for business logic, `app/api/` for HTTP handlers, `components/` for UI.

### Issues

| Severity | File | Issue |
|---|---|---|
| LOW | `lib/audit.ts:26` | `console.log("[AUDIT]", ...)` in production — should use a proper logger or DB persistence |
| LOW | `lib/email.ts:413-414` | `console.log` in dev path — acceptable but gated behind `NODE_ENV !== 'production'` |
| LOW | `lib/supabase/identity.ts:44` | Swallowed catch — returns fallback identity on DB error without logging |
| LOW | `app/api/investor-profile/route.ts:97` | `let latestRoi: any[] = []` — should be typed |
| LOW | `app/api/admin/withdrawals/route.ts:25` | Returns `NextResponse.json([], { status: 500 })` — 500 with empty array is unusual; should be error object |

---

## 2. Security — WARN

### Secrets in Code — PASS
- No hardcoded secrets. All credentials read from `process.env`.
- `.env.example` exists with placeholder values.
- `SUPABASE_SERVICE_ROLE_KEY` used only server-side in API routes.
- `JWT_SECRET` required for 2FA session signing with 32-char minimum.

### SQL Injection — PASS
- All database access via Drizzle ORM with parameterized queries (`eq()`, `and()`, `inArray()`).
- No raw SQL string concatenation found.
- `lib/db.ts` validates URL protocol and credentials before connecting.

### XSS — PASS
- React escapes by default.
- Email templates use `esc()` function for all dynamic values (`lib/email.ts:20-26`).
- No `dangerouslySetInnerHTML` found.

### CSRF — PASS
- Supabase auth uses Bearer tokens in `Authorization` header.
- Cookies set with `httpOnly`, `sameSite: 'lax'`, `secure` in production.
- `SameSite=Lax` provides CSRF protection for state-changing requests.

### Rate Limiting — WARN
- **Signup:** Rate limited via `checkAuthRateLimit` (5 attempts / 10 min) — GOOD.
- **2FA verify/disable:** Rate limited — GOOD.
- **Login:** **NO rate limit** on `/api/auth/login` or Supabase auth — **GAP**.
- **Admin mutations:** No rate limit on admin balance/assign-plan/deposit-approval — acceptable given admin-only access.
- **Rate limiter is in-memory stub:** `lib/rate-limit.ts` uses a `Map` — per-instance, not shared across replicas. Documented as "DB-BACKED STUB" with a comment that multi-instance prod needs Redis or DB table. **This is a WARN for production.**

### Insecure Redirects — PASS
- `lib/auth-redirect.ts` implements strict allowlist: `www.quantovests.com` and `quantovests.com` in prod.
- Fails closed in prod if `APP_PUBLIC_URL` not set.
- `buildEmailRedirectTo` validates `next` parameter starts with `/` and not `//`.

### PII Logging — PASS
- No PII in logs. Only user IDs, email addresses in notification contexts (which are necessary).
- Error messages are generic ("Internal server error") or user-safe.
- `lib/api-errors.ts` truncates error details to 240 chars and logs server-side only.

### Additional Security Notes
- **TOTP secret never exposed:** `investor-profile` returns only `twoFactorEnabled: boolean`, not the secret. GOOD.
- **Server-side TOTP on withdrawals:** `app/api/withdrawals/route.ts:36-41` verifies TOTP server-side. GOOD.
- **Recovery codes:** HMAC-SHA256 with pepper + userId salt. GOOD.
- **2FA session tokens:** HMAC-SHA256 signed, expiring, userId-bound. GOOD.
- **Fail-closed middleware:** Returns 503 if Supabase not configured. GOOD.

---

## 3. Test Coverage — WARN

### What's Covered (107 tests, all passing)
| Test File | Tests | What It Covers |
|---|---|---|
| `tests/unit/totp-session.test.ts` | 17 | TOTP generation, verification, clock skew, malformed input, 2FA session tokens |
| `tests/unit/middleware-routing.test.ts` | 60+ | Route classification (public/investor/admin), 2FA gate, admin allowlist |
| `tests/unit/money-guards.test.ts` | ~20 | Swap fee math, deposit validation, withdrawal guards, ROI BPS map |

### Strengths
- Tests are fast (21s total).
- TOTP tests use an independent RFC 4226 oracle — good practice.
- Money guard tests pin production source code patterns — catches accidental drift.
- Middleware tests are thorough — full routing matrix.

### Gaps

| Severity | Gap |
|---|---|
| **HIGH** | **No integration tests for money paths** — deposit approval, withdrawal settlement, swap execution, ROI credit are all untested end-to-end |
| **HIGH** | **No E2E tests** — no Playwright/Cypress tests for critical user flows |
| **MEDIUM** | **Source-pinning is brittle** — `money-guards.test.ts` reads source files and checks for string patterns; a refactor that changes formatting breaks tests without changing behavior |
| **MEDIUM** | **No tests for auth flow** — signup, login, password reset, OAuth callback untested |
| **MEDIUM** | **No tests for rate limiter** — the in-memory bucket logic is untested |
| **MEDIUM** | **No tests for recovery codes** — HMAC hashing, verification, legacy fallback untested |
| **LOW** | **No tests for email templates** — rendering, escaping, SMTP sending untested |
| **LOW** | **No tests for referral reward** — idempotency, amount calculation untested |

### Can a dev trust `pnpm test`?
**Partially.** The 107 tests give confidence in TOTP, middleware routing, and money guard formulas. But they don't test:
- Database interactions
- Authentication flows
- API endpoint behavior
- Error handling paths
- Integration between components

A dev should treat `pnpm test` as a smoke test, not a comprehensive safety net.

---

## 4. Handoff Readiness — PASS

### README — PASS
- 327 lines, comprehensive.
- Clear setup instructions with `cp .env.example .env.local`.
- Architecture diagram, user flows, feature table, tech stack.
- Documents the $3,000 withdrawal minimum, 2FA, close-account flow.
- References `docs/quantovest/` for detailed handoff.

### docs/quantovest/ — PASS
- 15 documents covering deployment, QA, configuration, portability, design, UI direction.
- `IMPLEMENTATION_HANDOFF.md` is a detailed prompt for onboarding a new dev.
- `PRODUCTION_CONFIGURATION_GUIDE.md` covers env vars, Supabase setup, Vercel deploy.
- `ONE_CLICK_PORTABILITY.md` explains how to migrate to a new Supabase project.
- `QA_REPORT.md` and `EVIDENCE_LOG.md` provide test evidence.

### .env.example — PASS
- Complete with all required variables.
- Clear comments explaining each variable.
- Placeholder values that are obviously not real.
- Includes optional OAuth and Tawk.to variables.

### Onboarding — PASS
- A new dev can clone, `npm install`, `cp .env.example .env.local`, fill in values, run `npm run dev`.
- `db/quantovest-install.sql` is idempotent bootstrap.
- Admin creation documented (SQL update).

### Missing
- **No CHANGELOG** — no `CHANGELOG.md` or release notes.
- **No CONTRIBUTING.md** — no contribution guidelines.
- **No API documentation** — no OpenAPI/Swagger spec (mentioned in README as "API Routes" but no formal docs).

---

## 5. Red Flags — WARN

### Commented-Out Code
- **None found.** Clean.

### Console.logs in Prod Paths
| File | Line | Issue |
|---|---|---|
| `lib/audit.ts` | 26 | `console.log("[AUDIT]", ...)` — should be a proper audit log (DB or structured logger) |
| `lib/email.ts` | 413-414 | Dev-only, gated by `NODE_ENV` — acceptable |

### Inconsistent Patterns
| Issue | Details |
|---|---|
| **Error response shape** | Some routes return `{ error: string }`, others return `{ error: string, code: string }` (api-errors.ts). Client must handle both. |
| **Empty vs error** | `admin/withdrawals` GET returns `[]` with 500 status on error — should return error object. |
| **Database fallback** | `investor-profile` has complex Supabase-js fallback when Drizzle fails — masks DB issues, could return stale data. |
| **Rate limiter** | In-memory only — won't work across multiple Vercel instances. |

### Missing Validation
| Endpoint | Issue |
|---|---|
| `/api/auth/login` | No rate limiting — brute-forceable |
| `/api/admin/balance` | No rate limiting — admin could spam credits |
| `/api/admin/assign-plan` | No rate limiting |
| `/api/deposits` | No rate limiting on POST (could spam deposit records) |

### Race Conditions in Money Code
| Endpoint | Assessment |
|---|---|
| `app/api/withdrawals/route.ts` | **SAFE** — uses `SELECT ... FOR UPDATE` in transaction |
| `app/api/swap/execute/route.ts` | **SAFE** — uses `FOR UPDATE` row locks |
| `app/api/admin/deposits/route.ts` | **SAFE** — `FOR UPDATE` + status check before balance update |
| `app/api/admin/withdrawals/route.ts` | **SAFE** — transaction with status check |
| `app/api/admin/roi/route.ts` | **SAFE** — transaction, but no `FOR UPDATE` on account (relies on transaction isolation) |
| `app/api/admin/balance/route.ts` | **SAFE** — transaction, no explicit lock but single update |
| `app/api/admin/assign-plan/route.ts` | **SAFE** — transaction with principal check |

### Other Concerns
- **`lib/email.ts` SMTP client:** Hand-rolled SMTP over TLS — works but fragile. Consider using `nodemailer` or a transactional email API (Resend, SendGrid) for reliability.
- **`lib/rate-limit.ts` DB probe:** The `try { const db = getDb(); if (db) { void db; } }` block is a no-op placeholder — confusing dead code.
- **`app/api/investor-profile/route.ts`:** 183 lines with multiple fallback paths — hard to test, easy to break.

---

## Prioritized Fix List

### P0 — Critical (fix before production)
1. **Add rate limiting to `/api/auth/login`** — brute-force protection is essential for a fintech app.
2. **Replace in-memory rate limiter with shared storage** — Redis, Upstash, or a `rate_limits` table. Current stub is per-instance and will fail under load balancing.

### P1 — High (fix soon)
3. **Add integration tests for money paths** — at minimum: deposit approval, withdrawal settlement, swap execution, ROI credit. Use a test Supabase project or mocked DB.
4. **Add E2E tests for critical flows** — signup → deposit → admin approval → withdrawal. Playwright is the standard choice.
5. **Fix `admin/withdrawals` GET error response** — return `{ error: ... }` not `[]` with 500.
6. **Remove dead code in `lib/rate-limit.ts`** — the `void db` no-op is confusing.

### P2 — Medium (fix in next iteration)
7. **Add tests for rate limiter** — bucket creation, window expiry, max attempts.
8. **Add tests for recovery codes** — HMAC, verification, legacy fallback.
9. **Type the `any[]` in `investor-profile/route.ts:97`** — use proper Drizzle inferred type.
10. **Replace `console.log` in `lib/audit.ts`** — use a structured logger or DB persistence.
11. **Standardize error response shape** — all routes should return `{ error: string, code?: string }`.
12. **Add CHANGELOG.md** — track user-facing changes.
13. **Add CONTRIBUTING.md** — document development workflow.

### P3 — Low (nice to have)
14. **Add API documentation** — OpenAPI spec or similar.
15. **Consider `nodemailer` or email API** — replace hand-rolled SMTP client.
16. **Refactor `investor-profile` fallback** — simplify or remove the Supabase-js fallback path.
17. **Add tests for email template rendering** — ensure escaping works correctly.

---

## Verdict

**The codebase is production-ready with caveats.** The security foundations are solid — the team has clearly thought about auth, authorization, input validation, and error handling. The code is clean, well-organized, and typed.

**The main risks are:**
1. **Rate limiting is a stub** — in-memory, per-instance, not on login. This is the biggest operational risk.
2. **Test coverage is shallow for money paths** — the 107 tests are good for what they cover, but they don't test the actual money-moving flows end-to-end.
3. **No E2E tests** — a senior dev would want at least a Playwright smoke test for the deposit → approval → withdrawal flow.

**A new dev could be productive in a day** — the README and docs are excellent, setup is straightforward, and the code is readable. But they should not touch money paths without adding integration tests first.

---

*End of review.*
