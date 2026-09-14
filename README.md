# Quantovest Capital

**"Your Capital. Their Expertise."**

A copytrading and investment platform for FX, Crypto, and Stocks. Investors choose a plan, deposit funds, and an experienced trader executes on their behalf. Investors track performance, holdings, and transactions through a live dashboard.

---

## How the App Works

### The Two Sides

The platform has two user roles: **Investor** and **Admin** (staff). They interact through a shared database — the admin enters data, the investor sees it.

```
┌─────────────────────────────────────────────────────────┐
│                    ADMIN (Staff)                         │
│                                                         │
│  1. Approves deposits    →  Investor balance updates    │
│  2. Publishes ROI        →  Investor chart moves        │
│  3. Approves KYC         →  Investor gets verified      │
│  4. Approves withdrawals →  Investor gets paid          │
│  5. Creates traders      →  Investors can copy them     │
│  6. Sends broadcasts     →  Investors get notified      │
└─────────────────────────────────────────────────────────┘
                          │
                    writes to DB
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   INVESTOR                               │
│                                                         │
│  1. Signs up             →  Gets a dashboard             │
│  2. Completes KYC        →  Uploads ID + proof of addr  │
│  3. Submits deposit      →  Waits for admin approval    │
│  4. Gets approved        →  Balance appears, plan active │
│  5. Copies a trader      →  Trades reflect on dashboard │
│  6. Sees ROI updates     →  Balance grows/shrinks       │
│  7. Requests withdrawal  →  Waits for admin approval    │
└─────────────────────────────────────────────────────────┘
```

### Fixed ROI Per Plan (7-Day Cycle)

| Plan | Plan Amount | ROI (7 days) | ROI USD on Plan Amount |
|---|---|---|---|
| **Starter** | $1,500 | **15%** | $225 |
| **Growth** | $7,500 | **25%** | $1,875 |
| **Elite** | $45,000 | **35%** | $15,750 |

Admin selects an investor and applies the fixed plan rate; the investor's balance, ledger, activity, and notifications update.

### The Full User Flow

#### Investor Journey
1. **Signup** → `/signup` → creates Supabase Auth account + DB user row
2. **Onboarding** → modal (experience, interests, goals, deposit target)
3. **KYC** → upload government ID + proof of address → admin reviews
4. **Deposit** → choose a plan or enter a custom $50+ amount → select payment method (USDT TRC-20 or BTC) → upload payment proof → admin approves → balance credited (a deposit never auto-assigns a plan)
5. **Dashboard** → see portfolio balance, performance chart, ROI updates, activity log
6. **Copy Trader** → after approved funding and KYC, browse portfolio managers and select one active manager (requires min $1,500 balance)
7. **Upgrade Plan** → Starter ($1,500) → Growth ($7,500) → Elite ($45,000) — upgrades when the account balance qualifies and records a plan-transition audit entry
8. **Withdraw** → enter amount (account balance must be ≥ **$3,000**) → 6-digit authenticator code if 2FA is enabled (verified server-side) → admin processes → money sent
9. **Close Account** → tick "Close Account & Withdraw Entire Balance" (amount must equal the full balance) → account is frozen as `closing` → admin approves → payout processed, plan cleared, account set to `closed` (rejecting reverts to `active` with balance refunded)
10. **Settings** → configure 2FA (TOTP via `/api/auth/2fa`), payout details, notification preferences

#### Admin Journey
1. **Login** → `/admin/login` → Supabase Auth + role check (must be `admin` role in DB)
2. **Dashboard** → total AUM, pending deposits/withdrawals/KYC counts
3. **Deposits** → review proof screenshots → approve (credits balance only — a deposit never auto-assigns a plan) or reject
4. **Assign Plan** → set an investor's plan, which credits the plan amount to their balance and records a plan-upgrade ledger entry
5. **Withdrawals** → review requests → approve (processes payout) or reject (reverses balance)
6. **KYC** → review uploaded documents → approve or decline with reason
7. **Performance** → select investor → add a market note → apply the fixed plan performance credit → investor balance, ledger, activity, and notifications update
8. **Traders** → create/edit master trader profiles with images and stats
9. **Notifications** → send broadcasts (all users, specific users, or plan-targeted)
10. **Plans** → manage Starter/Growth/Elite tiers
11. **Investors** → view all investor accounts with details
12. **Settings** → platform configuration

### Key Features

| Feature | How It Works |
|---|---|
| **Single Active Plan** | Each investor has one plan at a time. Plans are set by admin (Assign Plan) or by an in-app purchase — never auto-assigned by a deposit. |
| **Manual Performance Credit** | Starter=15%, Growth=25%, Elite=35% per 7-day cycle — admin applies the plan’s fixed rate per investor |
| **Close Account** | Withdraw entire balance + close account in one request; status flows `active` → `closing` → `closed`, deposits/swaps/copy blocked while closing |
| **2FA (TOTP)** | Optional. If enabled, withdrawals require a 6-digit code verified server-side against the stored secret (secret is never sent to the browser) |
| **Email System** | 15 templates (deposit, withdrawal, KYC, ROI, referral, security, broadcast) via Resend |
| **Notifications** | In-app bell icon + optional email. Security/financial emails are always-on |
| **ROI Calculator** | Interactive simple-return projection with transparent assumptions and risk disclosure |
| **Mobile Responsive** | Slide-in drawer + sticky header on mobile, fixed sidebar on desktop |
| **Legal Pages** | Full Privacy Policy, Terms of Service, Risk Disclosure |

### Architecture

```
Frontend (Next.js App Router)
├── Public Pages (light mode) — Homepage, Plans, FAQ, Legal, etc.
├── Investor Portal (dark mode) — Dashboard, Deposit, Withdraw, Settings, etc.
└── Admin Panel (dark mode) — Dashboard, Deposits, KYC, ROI, Notifications, etc.

API Routes (server-side, 50+ endpoints)
├── /api/auth/* — Signup, session check
├── /api/deposits, /api/withdrawals, /api/kyc — Investor CRUD
├── /api/investor-profile, /api/investor/upgrade — Profile & plan management
├── /api/admin/* — Admin operations (all require admin role)
└── /api/uploads — File upload to Supabase Storage

Database (Supabase Postgres via Drizzle ORM)
├── users — id, email, name, role (investor/admin)
├── investorAccounts — balance, plan, ROI tracking
├── plans — Starter/Growth/Elite with fixed 7-day ROI
├── deposits, investorWithdrawals — financial records
├── kycApplications — verification documents
├── roiEntries — ROI log per investor
├── traders — master trader cards
├── notifications — in-app messages
├── portfolioLedger — transaction history
└── referral* — referral tracking tables

Auth (Supabase Auth)
├── Email/password signup + Google OAuth
├── Middleware checks session cookie on every request
├── Route protection (public/investor/admin)
└── Admin role verified from DB (not client-side)

Email (Resend integration)
├── 15 HTML templates (deposit, KYC, withdrawal, ROI, referral, security, broadcast)
├── Falls back to console logging in dev mode
└── Security/financial emails always send (ignores preferences)
```

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS + CSS custom properties |
| Database | Supabase Postgres + Drizzle ORM |
| Auth | Supabase Auth (email/password, OAuth) |
| Charts | Recharts |
| Motion | Framer Motion + GSAP/ScrollTrigger |
| Icons | Solar Icons via Iconify |
| Email | Resend (free tier: 100/day) |
| Hosting | Vercel |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works)

### Setup

```bash
# Clone
git clone https://github.com/Akakaui/quantovest-capital.git
cd quantovest-capital

# Install
npm install

# Configure environment
cp .env.example .env.local
# Fill in your Supabase URL, anon key, and service role key

# Set up the database in one run
# In the Supabase SQL Editor, paste the contents of db/quantovest-install.sql and run it once.
# This creates all tables, indexes, seed plans, the private media bucket, and security policies.

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### One-Click Portability

For a new owner or a new Supabase project, run [`db/quantovest-install.sql`](./db/quantovest-install.sql) once. The bootstrap creates the application tables, indexes, seed plans, private `quantovest-media` bucket, and guarded security policies. It does not copy customer data or secrets and does not configure external providers such as Resend, Zoho, Vercel, OAuth, or Tawk.to.

This single file is the one and only schema source for a fresh install. It is safe to re-run on the same database because every statement is idempotent (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT`, and replaceable policies).

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://postgres:password@pooler.supabase.com:6543/postgres

# App
APP_PUBLIC_URL=http://localhost:3000

# 2FA session signing secret (REQUIRED for 2FA; random, at least 32 chars)
JWT_SECRET=your-long-random-secret

# Email (Zoho SMTP — logs to console without this)
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=465
ZOHO_SMTP_USER=support@quantovests.com
ZOHO_SMTP_PASS=your_zoho_app_password
EMAIL_FROM=Quantovest Capital <support@quantovests.com>
```

### Creating an Admin User

1. Sign up through the normal signup flow
2. In your Supabase SQL editor, run:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
   ```
3. Log in at `/admin/login`

---

## Documentation

All project handoff and QA documentation is consolidated in [`docs/quantovest/`](./docs/quantovest/), including the implementation handoff, sanitized environment patch, deployment notes, QA report, evidence log, UI direction, and calculator review asset.

---

## Project Structure

```
app/
├── page.tsx                    # Homepage (hero, stats, plans, calculator)
├── layout.tsx                  # Root layout
├── globals.css                 # Design tokens + global styles
├── how-it-works/               # How It Works page
├── about/                      # About Us page
├── services/                   # Services page (FX/Crypto/Stocks)
├── plans/                      # Investment Plans page
├── faq/                        # FAQ page
├── contact/                    # Contact page
├── legal/
│   ├── privacy/                # Privacy Policy (10 sections)
│   ├── terms/                  # Terms of Service (13 sections)
│   └── risk/                   # Risk Disclosure (10 sections)
├── login/                      # Investor login
├── signup/                     # Investor signup
├── auth/callback/              # Supabase OAuth callback
├── dashboard/
│   ├── page.tsx                # Portfolio balance, chart, activity
│   ├── deposit/                # Deposit with proof upload
│   ├── withdraw/               # Withdraw + close-account request
│   ├── traders/                # Copy traders
│   ├── settings/               # 2FA, payout details, notifications
│   ├── kyc/                    # KYC document upload
│   ├── referrals/              # Referral program
│   ├── history/                # Transaction history + export
│   ├── portfolio/              # Holdings + allocation
│   └── swap/                   # Asset swap
├── admin/
│   ├── page.tsx                # AUM, pending counts, quick announcement composer
│   ├── login/                  # Admin login
│   ├── deposits/               # Deposit approval queue
│   ├── withdrawals/            # Withdrawal + account-closure approval queue
│   ├── kyc/                    # KYC review queue
│   ├── performance/            # Per-investor ROI entry (+ [investorId] detail)
│   ├── traders/                # Trader management
│   ├── notifications/          # Messaging composer (all / personal / plan)
│   ├── plans/                  # Plan management
│   ├── investors/              # Investor table (+ [id] detail)
│   ├── referrals/              # Referral payout queue
│   ├── support/                # Tawk.to dashboard link
│   └── settings/               # Platform settings
└── api/                        # 25+ server-side API routes
    ├── auth/signup/            # User creation + DB row
    ├── auth/me/                # Current user + role
    ├── deposits/               # Investor deposit CRUD
    ├── withdrawals/            # Investor withdrawal CRUD
    ├── kyc/                    # Investor KYC CRUD
    ├── investor-profile/       # Aggregated profile data
    ├── investor/upgrade/       # Plan upgrade
    ├── notifications/          # Notification CRUD
    ├── uploads/                # File upload to Supabase Storage
    └── admin/                  # Admin-only operations
        ├── deposits/           #   Approve/reject deposits
        ├── withdrawals/        #   Approve/reject withdrawals
        ├── kyc/                #   Approve/reject KYC
        ├── roi/                #   Publish fixed ROI
        ├── traders/            #   Manage traders
        ├── notifications/      #   Send broadcasts
        ├── plans/              #   Manage plans
        ├── investors/          #   List investors
        └── deposit-instructions/ # Configure payment methods

components/
├── Navbar.tsx                  # Public site navigation
├── Footer.tsx                  # Public site footer
├── InvestorSidebar.tsx         # Investor sidebar + mobile bottom nav
├── AdminSidebar.tsx            # Admin sidebar + mobile bottom nav
├── NotificationCenter.tsx      # Bell icon + notification dropdown
├── TawkToWidget.tsx            # Tawk.to live-chat widget
├── DashboardAreaChart.tsx      # Portfolio performance chart
├── OnboardingModal.tsx         # Post-signup wizard
├── KycModal.tsx                # KYC prompt overlay
├── FundingWarningModal.tsx     # Insufficient balance alert
├── RoiCalculatorModal.tsx      # ROI calculator with fixed rates
├── ThreeDPhoneHero.tsx         # Homepage hero
├── SignalLine.tsx              # SVG line animation
├── CountUpNumber.tsx           # Animated counter
└── AllocationRingChart.tsx     # Portfolio donut chart

lib/
├── auth-helpers.ts             # requireAuth() / requireAdmin()
├── db.ts                       # Drizzle database connection
├── email.ts                    # Email templates + Resend sender
├── notifications.ts            # Notification helpers
├── audit.ts                    # Audit logging
├── totp.ts                     # TOTP 2FA helpers
├── uploadRules.ts              # File upload validation
└── supabase/
    ├── client.ts               # Browser Supabase client
    ├── server.ts               # Server Supabase client
    └── identity.ts             # Get current user + role

db/
├── schema.ts                   # Drizzle table definitions (type source)
└── quantovest-install.sql      # Single canonical bootstrap — run once in Supabase
```
