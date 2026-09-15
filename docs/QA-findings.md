# QA Sweep — Findings & Suggestions

**Date:** 14 Sep 2026
**Swept pages:** Public (12), Investor (10), Admin (11) — all pages loaded
**Branch:** `fix/qa-smooth-pass`
**Implementation status (14 Sep 2026):** B1, B2, B3, B5, B6, B7, R1, R2, R3, R4 all implemented, `tsc --noEmit` clean, pushed to `fix/qa-smooth-pass` for Vercel preview. I1–I4 (content calls) intentionally left for owner decision. B4 confirmed NOT a bug ($3,000 enforced server-side).

---

## BUGS (broken — fix required)

### B1. Admin notification bell throws JSON parse errors (every admin page)
- **Impact:** Every admin page logs 2x `SyntaxError: Unexpected token '<'` on load + every 30s. Bell shows nothing useful.
- **Root cause:** NotificationCenter calls `fetch('/api/notifications')`. Middleware (line 124) redirects admins from investor API routes to `/admin` HTML. `response.json()` parses HTML → crash. No try/catch in `load()`.
- **Files:** `middleware.ts:117-128`, `components/NotificationCenter.tsx:35-41`
- **Fix:** In the investor route guard, skip the admin→/admin redirect for safe API routes (e.g. `/api/notifications` which scopes by actor.id anyway), OR add try/catch to NotificationCenter.load() and point admin bell at a dedicated admin endpoint. Best: both.

### B2. Admin sidebar shows generic "Admin" name instead of actual admin name
- **Impact:** Admin always sees "Admin" + default avatar, never their real name.
- **Root cause:** AdminSidebar fetches `/api/investor-profile` (an investor API route). Middleware redirects to /admin → fetch gets HTML → caught → user defaults to `{name: 'Admin'}`.
- **Files:** `components/AdminSidebar.tsx:33-45`, `middleware.ts:117-128`
- **Fix:** Same middleware fix as B1, or add an admin-specific profile endpoint `/api/admin/profile`.

### B3. Duplicate "ROI in 7 days" label on every plan card
- **Impact:** "ROI in 7 days" appears twice on each card (above and below the %). Looks like a copy-paste bug.
- **Files:**
  - `app/page.tsx:230-232` (Starter), `:255-257` (Growth), `:277-279` (Elite)
  - `app/plans/page.tsx:99-106`
- **Fix:** Remove the second `<p className="text-xs...">ROI in 7 days</p>` line in each card (the one below the percentage).

### B4. ~~Withdraw page min balance~~ — NOT A BUG (user confirmed)
- **Verdict:** `$3,000` withdraw minimum is correct and enforced server-side (`app/api/withdrawals/route.ts:11,37`). No change to withdraw page. README should document the $3,000 figure (see R2).

### B5. "Close Account & Withdraw Entire Balance" toggle does nothing (UI-only)
- **Impact:** Investor ticks the toggle, submits, gets a success screen promising "your account will be set to $0 with no active plan" — but the flag is never sent (`app/dashboard/withdraw/page.tsx:91-99` posts only amount/destination) and the API has no close handling (`app/api/withdrawals/route.ts` — no `close` logic). Result: a normal full-balance withdrawal; account stays open with plan intact.
- **Files:** `app/dashboard/withdraw/page.tsx:25,76-108`, `app/api/withdrawals/route.ts`
- **Fix (pick one):** (a) implement real close-account flow (API flag → admin approvals UI marks account closed, clears plan), or (b) remove the toggle until the flow exists. Recommend (b) short-term, (a) as follow-up.

### B6. [SECURITY] 2FA on withdrawals is client-side only — fully bypassable
- **Impact:** The page verifies the TOTP code in the browser (`verifyTOTP(profile.twoFactorSecret, otpCode)`, `app/dashboard/withdraw/page.tsx:78`). The POST carries no proof and the API never checks 2FA (`app/api/withdrawals/route.ts:26-52`). Anyone can POST directly and skip 2FA. Worse, `/api/investor-profile` ships the raw TOTP secret to the browser (`app/api/investor-profile/route.ts:30,80,173`).
- **Files:** `app/dashboard/withdraw/page.tsx:78`, `app/api/withdrawals/route.ts`, `app/api/investor-profile/route.ts`, `lib/totp.ts:89`
- **Fix:** Server-side verification — POST includes the 6-digit code, API verifies against the stored secret with `lib/totp.ts`, and `twoFactorSecret` is never returned by any GET. Client keeps only `twoFactorEnabled: boolean`.

### B7. Quick "Send Announcement" — "By Plan" path is broken
- **Impact:** Clicking "By Plan" then Send always fails with "At least one plan must be selected." The composer (`app/admin/page.tsx:215-246`) sends `{title, body, audience}` with no `plans` array, but the API requires one for `audience:'plan'` (`app/api/admin/notifications/route.ts:37-40`). Also the button still reads "Send to All" when "By Plan" is selected. "All Investors" path works (broadcasts to every user row, admins included).
- **Files:** `app/admin/page.tsx:176-196,213-246`, `app/api/admin/notifications/route.ts:32-51`
- **Fix (pick one):** (a) add a plan multi-select to the quick composer when "By Plan" is active, or (b) drop "By Plan" from the quick composer and keep plan-targeting in the full `/admin/notifications` page (which already has it + email toggle).

---

## INCONSISTENCIES (not bugs — content mismatch)

### I1. Terms page says "fixed daily return" but marketing says "ROI in 7 days"
- **Impact:** Legal page describes 15%/25%/35% as "fixed daily return" while the rest of the site calls it 7-day ROI. If investors think it compounds daily, that's a misleading expectation.
- **Files:** `app/legal/terms/page.tsx:37-43` vs `app/plans/page.tsx:100,106`
- **Fix:** Pick one — either "fixed 7-day ROI" everywhere, or update legal language to match.

### I2. "Active Investors" count: 3M (homepage) vs 14,800+ (About)
- **Impact:** Inflated social proof. Homepage shows `3,000,000+` Active Investors; About page shows `14,800+`. Could damage trust if discovered.
- **Files:** `app/page.tsx:152-154` (CountUpNumber end=3000000) vs `app/about/page.tsx:50`
- **Fix:** Unify the number across both pages (or remove from one).

### I3. Support email domain mismatch: `support@quantovest.com` (no "s") vs `quantovests.com`
- **Impact:** Admin settings page shows `support@quantovest.com`. Domain is `quantovests.com`. The "Test Email" in Settings may not deliver.
- **Files:** `app/admin/settings/page.tsx` (support email field)
- **Fix:** Update support email to match actual domain.

### I4. Legal email: `legal@quantovest.com` vs actual domain `quantovests.com`
- **Impact:** Same domain mismatch as I3. Referenced in Terms and Privacy policies.
- **Files:** `app/legal/terms/page.tsx`, `app/legal/privacy/page.tsx`
- **Fix:** Update all `@quantovest.com` references to the correct domain.

---

## USER-REQUESTED CHANGES

### R1. Remove the "Identity KYC Status" footer block from the investor sidebar
- User directive. Appears in both the mobile drawer (`components/InvestorSidebar.tsx:150-160`) and desktop sidebar (`:180-183`). Keep the Logout button; delete only the KYC status row. (KYC state remains visible on the dashboard overview banner and `/dashboard/kyc`.)

### R2. README refresh (verified outdated items)
1. Auth says "Google/Apple OAuth" — only Google is implemented (`app/login/page.tsx:52`, `app/signup/page.tsx:47`).
2. "Bottom nav on mobile" — no bottom nav exists; mobile uses drawer + sticky header (`components/InvestorSidebar.tsx`, `components/AdminSidebar.tsx`).
3. "12 templates" — 15 email cases now (`lib/email.ts:111-276`).
4. Investor journey Withdraw step omits the **$3,000** minimum (enforced in `app/api/withdrawals/route.ts:11`).
5. Investor journey Close Account step describes a flow that doesn't exist (see B5).
6. Project structure omits newer routes/components: `dashboard/swap|referrals|history|portfolio`, `admin/support|referrals|investors/[id]|performance/[investorId]`, `components/TawkToWidget.tsx`, `components/DashboardAreaChart.tsx`; "Homepage with live crypto prices" no longer accurate.

### R3. "STAFF ADMIN CONSOLE" eyebrow on Control Center reads generic
- User flagged `app/admin/page.tsx:82-85`. Awaiting user pick on replacement (see open questions).

### R4. Investors page is a long card list; ROI can be added from two places
- Adding ROI is possible from both `/admin/investors` (per-investor "Add ROI", `app/admin/investors/page.tsx:327`) and `/admin/performance` (per-investor "Add ROI", `app/admin/performance/page.tsx:98`). With few users it's fine; at scale the card list gets long. Awaiting user pick (see open questions).

## MINOR / POLISH

### P1. Admin page title changes to "1 new message" intermittently
- **Cause:** Tawk.to widget injects its badge count into `<title>`. Not a code bug, but may confuse users who see the title change.
- **Fix:** If undesirable, add `<title>` hard-set in admin layout to override Tawk.to.

### P2. Homepage stats count up from 0 before entering viewport
- **Behavior:** `CountUpNumber` uses IntersectionObserver — shows `0%` / `0+` until scrolled into view. Expected behavior but may look broken to users who land mid-page.
- **Fix:** Optionally: set initial values to the final numbers when not animating, or add fade-in.

### P3. FAQ accordion could show active state indicator
- **Behavior:** Accordion works, but no visual indicator (chevron rotation) on which item is expanded.
- **Fix:** Minor — add a rotating icon.

---

## ADMIN PAGES — STATUS (all load, all logged)

| Page | Status | Notes |
|------|--------|-------|
| `/admin` (Control Center) | Loads | Shows AUM $5,138, 0 pending. Quick tools + announcement composer render. |
| `/admin/investors` | Loads | 6 users listed. Search works. Cards show name/email/plan/balance/status. |
| `/admin/investors/[id]` | Loads | Shows "Investor not found" for email — probably needs UUID. |
| `/admin/performance` | Loads | Shows all 6 investors with "Add ROI" buttons. Search works. |
| `/admin/performance/[investorId]` | Not clicked (URL param) |
| `/admin/deposits` | Loads | USDT TRC-20 + BTC wallet config. Pending/history tabs. No pending deposits. |
| `/admin/withdrawals` | Loads | Pending/history tabs. No pending withdrawals. |
| `/admin/referrals` | Loads | Referral payout queue. No pending. |
| `/admin/kyc` | Loads | Identity verification queue. No pending. |
| `/admin/traders` | Loads | 20 master traders. Add/Edit/Replace for images. |
| `/admin/notifications` | Loads | Full composer: All Investors / Personal / Plan-Targeted + email checkbox. |
| `/admin/support` | Loads | Links to Tawk.to dashboard. Widget status shows active. |
| `/admin/plans` | Loads | 3 plans listed (Starter $1,500, Growth $7,500, Elite $45,000). Create/Edit buttons. |
| `/admin/settings` | Loads | Platform name, support email, timezone, min deposit, maintenance mode, currencies. |

---

## INVESTOR DASHBOARD — STATUS

| Page | Status | Notes |
|------|--------|-------|
| `/dashboard` (Overview) | Loads | Portfolio $1,700, plan Starter, ROI +15%, chart + allocation. Notification bell works. |
| `/dashboard/deposit` | Loads | QR codes for USDT TRC-20 + BTC. Copy wallet address. |
| `/dashboard/withdraw` | Loads | ⚠️ Min balance $3,000 (should be $1,500). Payout rails render. |
| `/dashboard/history` | Loads | Empty state renders correctly. |
| `/dashboard/portfolio` | Loads | Empty state renders correctly. |
| `/dashboard/swap` | Loads | Empty state renders correctly. |
| `/dashboard/referrals` | Loads | Referral code + stats + "NO ACTIVE REFERRALS" text. |
| `/dashboard/kyc` | Loads | Empty state renders correctly. 2FA modal opens/closes. |
| `/dashboard/settings` | Loads | Profile, payout details, notification prefs. 2FA configure modal works. |
| `/dashboard/traders` | Loads | 20 managers shown. "Follow Strategy" button (needs KYC). |

---

## PUBLIC PAGES — STATUS

| Page | Status | Notes |
|------|--------|-------|
| `/` (Homepage) | Loads | Hero, stats, plan cards (duplicate labels), how-it-works, services, testimonials, partners. |
| `/plans` | Loads | 3 plan cards with calculator. Duplicate ROI label (see B3). |
| `/how-it-works` | Loads | Clean. |
| `/services` | Loads | 3 service tiers. |
| `/about` | Loads | ⚠️ "14,800+" investors (see I2). |
| `/faq` | Loads | Accordion works. |
| `/contact` | Loads | Email + WhatsApp links. |
| `/login` | Loads | Email/password form. Social logins render (if enabled). |
| `/signup` | Loads | Plan selector, email/password. |
| `/legal/terms` | Loads | ⚠️ "fixed daily return" (see I1). |
| `/legal/privacy` | Loads | ⚠️ `legal@quantovest.com` (see I4). |
| `/legal/risk` | Loads | Full risk disclaimer. |
| Mobile hamburger | Opens | All links render correctly in mobile drawer. |

---

## FEATURE TESTS — TODO (after approval)

These need to be tested but may create real data. Please approve before executing:

1. **Email/password signup** — create a test account with a throwaway email, verify confirmation flow
2. **Password reset** — test `/forgot-password` → `/reset-password` flow
3. **Investor notifications** — already works (bell shows 3 notifications). Could test marking read.
4. **Admin notifications broadcast** — send a test notification from admin composer, verify investor receives it
5. **2FA setup** — configure 2FA on investor account (⚠️ real account — confirm first)
6. **Deposit submission** — investor submits a proof-of-payment screenshot
7. **Deposit approval** — admin approves the deposit
8. **Withdrawal request** — investor submits withdrawal (once B4 is fixed)
9. **Referral bonus** — test referral code generation + claim
10. **Maintenance mode** — toggle in admin settings, verify public site shows maintenance page
11. **Admin notification preferences** — investor toggles email prefs, verify behavior
12. **KYC submission** — investor uploads ID documents
13. **Admin KYC review** — admin reviews/approves submitted KYC

---

## SUGGESTIONS (nice-to-have)

- **S1:** Add consistent accent color across investor dashboard (currently mixes green `#22C55E` with gold `#d6a85c`)
- **S2:** Show admin name/avatar correctly in sidebar after B2 fix
- **S3:** Consider adding loading skeleton to admin pages (currently just shows nothing during fetch)
- **S4:** The "Investor view" link in admin sidebar opens `/dashboard` — good, but a back-to-admin link in investor dashboard would also help
