-- ============================================================
-- Quantovest Capital — Database Setup
-- Single source of truth for manual Supabase SQL Editor setup.
-- Safe to run on a fresh database. Run once top-to-bottom.
-- ============================================================

-- ── 0000: Core tables ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "accounts" (
	"userId" varchar(191) NOT NULL,
	"type" varchar(32) NOT NULL,
	"provider" varchar(191) NOT NULL,
	"providerAccountId" varchar(191) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(64),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"name" varchar(191),
	"email" varchar(191),
	"emailVerified" timestamp with time zone,
	"image" text,
	"phone" varchar(32),
	"role" varchar(24) DEFAULT 'investor' NOT NULL,
	"onboardingCompleted" boolean DEFAULT false NOT NULL,
	"onboardingAnswers" json,
	"twoFactorEnabled" boolean DEFAULT false NOT NULL,
	"twoFactorSecret" text,
	"payoutDetails" json,
	"notificationPrefs" json,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(191) NOT NULL,
	"expires" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "verificationTokens" (
	"identifier" varchar(191) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verificationTokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);

CREATE TABLE IF NOT EXISTS "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"minimumDepositCents" integer NOT NULL,
	"maximumDepositCents" integer,
	"minRoiBps" integer NOT NULL,
	"maxRoiBps" integer NOT NULL,
	"active" integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS "investorAccounts" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"planId" integer,
	"principalCents" integer DEFAULT 0 NOT NULL,
	"balanceCents" integer DEFAULT 0 NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "traders" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"name" varchar(191) NOT NULL,
	"imageUrl" text,
	"imagePath" varchar(255),
	"specialty" varchar(100) NOT NULL,
	"winRateBps" integer DEFAULT 0 NOT NULL,
	"thirtyDayReturnBps" integer DEFAULT 0 NOT NULL,
	"riskLevel" integer DEFAULT 1 NOT NULL,
	"bio" text,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "deposits" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"amountCents" integer NOT NULL,
	"method" varchar(16) NOT NULL,
	"proofPath" text,
	"planId" integer,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"reviewedBy" varchar(191),
	"reviewNote" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "roiEntries" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"planId" integer NOT NULL,
	"percentageBps" integer NOT NULL,
	"profitCents" integer NOT NULL,
	"marketNote" text NOT NULL,
	"publishedBy" varchar(191) NOT NULL,
	"entryDate" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "portfolioLedger" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"type" varchar(32) NOT NULL,
	"amountCents" integer NOT NULL,
	"referenceId" varchar(191),
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" varchar(191) NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"relatedRewardId" integer,
	"isRead" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referralLinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" varchar(191) NOT NULL,
	"code" varchar(64) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referralAttributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrerId" varchar(191) NOT NULL,
	"referredInvestorId" varchar(191) NOT NULL,
	"linkId" integer NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"attributedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referralRewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"attributionId" integer NOT NULL,
	"referrerId" varchar(191) NOT NULL,
	"referredInvestorId" varchar(191) NOT NULL,
	"qualifyingDepositId" varchar(191) NOT NULL,
	"idempotencyKey" varchar(191) NOT NULL,
	"qualifyingAmountCents" integer NOT NULL,
	"rewardAmountCents" integer NOT NULL,
	"status" varchar(24) DEFAULT 'available' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

-- ── 0001: Deposits, KYC, Withdrawals, Instructions ────────────

CREATE TABLE IF NOT EXISTS "depositInstructions" (
	"id" serial PRIMARY KEY NOT NULL,
	"method" varchar(16) NOT NULL,
	"label" varchar(120) NOT NULL,
	"details" text NOT NULL,
	"qrPath" text,
	"active" integer DEFAULT 1 NOT NULL,
	"updatedBy" varchar(191) NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kycApplications" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"documentPath" text NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"reviewedBy" varchar(191),
	"reviewNote" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "investorWithdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"amountCents" integer NOT NULL,
	"destinationType" varchar(16) NOT NULL,
	"destination" varchar(255) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"reviewedBy" varchar(191),
	"reviewNote" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referralWithdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"amountCents" integer NOT NULL,
	"destinationType" varchar(16) NOT NULL,
	"destination" varchar(255) NOT NULL,
	"destinationDetails" text,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"reviewedBy" varchar(191),
	"reviewNote" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

-- ── 0002: Portfolio, Copy Trading, Swap, Push ─────────────────

CREATE TABLE IF NOT EXISTS "portfolioHoldings" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"assetSymbol" varchar(16) NOT NULL,
	"assetName" varchar(100) NOT NULL,
	"quantity" varchar(64) DEFAULT '0' NOT NULL,
	"costBasisCents" integer DEFAULT 0 NOT NULL,
	"currentPriceCents" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "copyAllocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"traderId" varchar(191) NOT NULL,
	"allocationCents" integer DEFAULT 0 NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "swapTransactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"fromAsset" varchar(16) NOT NULL,
	"toAsset" varchar(16) NOT NULL,
	"fromAmount" varchar(64) NOT NULL,
	"toAmount" varchar(64) NOT NULL,
	"rate" varchar(64) NOT NULL,
	"feeCents" integer DEFAULT 0 NOT NULL,
	"status" varchar(24) DEFAULT 'completed' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "swapConfig" (
	"id" serial PRIMARY KEY NOT NULL,
	"fromAsset" varchar(16) NOT NULL,
	"toAsset" varchar(16) NOT NULL,
	"rateMultiplier" varchar(32) DEFAULT '1' NOT NULL,
	"feeBps" integer DEFAULT 50 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pushSubscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" varchar(191) NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"userAgent" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recoveryCodes" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" varchar(191) NOT NULL,
  "codeHash" varchar(64) NOT NULL,
  "usedAt" timestamp with time zone,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platformSettings" (
  "id" serial PRIMARY KEY NOT NULL,
  "settingKey" varchar(64) NOT NULL,
  "settingValue" json NOT NULL,
  "updatedBy" varchar(191) NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "auditLog" (
  "id" serial PRIMARY KEY NOT NULL,
  "actorId" varchar(191) NOT NULL,
  "action" varchar(64) NOT NULL,
  "targetType" varchar(64) NOT NULL,
  "targetId" varchar(191) NOT NULL,
  "details" json,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "rateLimits" (
  "key" varchar(191) PRIMARY KEY NOT NULL,
  "count" integer NOT NULL,
  "windowStarted" timestamp with time zone NOT NULL
);

-- ── Indexes ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "investor_accounts_investor_unique" ON "investorAccounts" USING btree ("investorId");
CREATE INDEX IF NOT EXISTS "deposits_investor_idx" ON "deposits" USING btree ("investorId");
CREATE INDEX IF NOT EXISTS "deposits_status_idx" ON "deposits" USING btree ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "deposit_instructions_method_unique" ON "depositInstructions" USING btree ("method");
CREATE INDEX IF NOT EXISTS "kyc_applications_investor_idx" ON "kycApplications" USING btree ("investorId");
CREATE INDEX IF NOT EXISTS "kyc_applications_status_idx" ON "kycApplications" USING btree ("status");
CREATE INDEX IF NOT EXISTS "investor_withdrawals_investor_idx" ON "investorWithdrawals" USING btree ("investorId");
CREATE UNIQUE INDEX IF NOT EXISTS "referral_links_code_unique" ON "referralLinks" USING btree ("code");
CREATE INDEX IF NOT EXISTS "referral_links_owner_idx" ON "referralLinks" USING btree ("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "referral_attributions_referred_unique" ON "referralAttributions" USING btree ("referredInvestorId");
CREATE INDEX IF NOT EXISTS "referral_attributions_referrer_idx" ON "referralAttributions" USING btree ("referrerId");
CREATE UNIQUE INDEX IF NOT EXISTS "referral_rewards_key_unique" ON "referralRewards" USING btree ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "referral_rewards_referrer_idx" ON "referralRewards" USING btree ("referrerId");
CREATE INDEX IF NOT EXISTS "referral_withdrawals_investor_idx" ON "referralWithdrawals" USING btree ("investorId");
CREATE UNIQUE INDEX IF NOT EXISTS "roi_entries_investor_date_unique" ON "roiEntries" USING btree ("investorId","entryDate");
CREATE INDEX IF NOT EXISTS "roi_entries_investor_date_idx" ON "roiEntries" USING btree ("investorId","entryDate");
CREATE INDEX IF NOT EXISTS "roi_entries_investor_idx" ON "roiEntries" USING btree ("investorId");
CREATE INDEX IF NOT EXISTS "portfolio_ledger_investor_idx" ON "portfolioLedger" USING btree ("investorId");
CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_ledger_reference_unique" ON "portfolioLedger" USING btree ("type","referenceId");
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "portfolio_holdings_investor_idx" ON "portfolioHoldings" USING btree ("investorId");
CREATE INDEX IF NOT EXISTS "portfolio_holdings_symbol_idx" ON "portfolioHoldings" USING btree ("assetSymbol");
CREATE INDEX IF NOT EXISTS "copy_allocations_investor_idx" ON "copyAllocations" USING btree ("investorId");
CREATE INDEX IF NOT EXISTS "copy_allocations_trader_idx" ON "copyAllocations" USING btree ("traderId");
CREATE UNIQUE INDEX IF NOT EXISTS "copy_allocations_investor_trader_unique" ON "copyAllocations" USING btree ("investorId","traderId");
CREATE INDEX IF NOT EXISTS "swap_transactions_investor_idx" ON "swapTransactions" USING btree ("investorId");
CREATE UNIQUE INDEX IF NOT EXISTS "swap_config_pair_unique" ON "swapConfig" USING btree ("fromAsset","toAsset");
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "pushSubscriptions" USING btree ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_unique" ON "pushSubscriptions" USING btree ("endpoint");
CREATE INDEX IF NOT EXISTS "recovery_codes_user_idx" ON "recoveryCodes" USING btree ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "recovery_codes_hash_unique" ON "recoveryCodes" USING btree ("codeHash");
CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_key_unique" ON "platformSettings" USING btree ("settingKey");
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "auditLog" USING btree ("actorId");
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "auditLog" USING btree ("action");

-- ── Foreign keys ─────────────────────────────────────────────────
-- Idempotent: each constraint is added only if it does not already exist.
-- Financial records use RESTRICT (a user with deposits/rewards cannot be
-- deleted); user-owned rows use CASCADE; optional plan links use SET NULL.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounts_user') THEN
    ALTER TABLE public."accounts" ADD CONSTRAINT fk_accounts_user FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sessions_user') THEN
    ALTER TABLE public."sessions" ADD CONSTRAINT fk_sessions_user FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_deposits_investor') THEN
    ALTER TABLE public."deposits" ADD CONSTRAINT fk_deposits_investor FOREIGN KEY ("investorId") REFERENCES public."users"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_deposits_plan') THEN
    ALTER TABLE public."deposits" ADD CONSTRAINT fk_deposits_plan FOREIGN KEY ("planId") REFERENCES public."plans"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_kyc_investor') THEN
    ALTER TABLE public."kycApplications" ADD CONSTRAINT fk_kyc_investor FOREIGN KEY ("investorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ref_links_owner') THEN
    ALTER TABLE public."referralLinks" ADD CONSTRAINT fk_ref_links_owner FOREIGN KEY ("ownerId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ref_attr_referrer') THEN
    ALTER TABLE public."referralAttributions" ADD CONSTRAINT fk_ref_attr_referrer FOREIGN KEY ("referrerId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ref_attr_referred') THEN
    ALTER TABLE public."referralAttributions" ADD CONSTRAINT fk_ref_attr_referred FOREIGN KEY ("referredInvestorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ref_attr_link') THEN
    ALTER TABLE public."referralAttributions" ADD CONSTRAINT fk_ref_attr_link FOREIGN KEY ("linkId") REFERENCES public."referralLinks"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ref_rewards_attr') THEN
    ALTER TABLE public."referralRewards" ADD CONSTRAINT fk_ref_rewards_attr FOREIGN KEY ("attributionId") REFERENCES public."referralAttributions"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ref_rewards_referrer') THEN
    ALTER TABLE public."referralRewards" ADD CONSTRAINT fk_ref_rewards_referrer FOREIGN KEY ("referrerId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ref_rewards_referred') THEN
    ALTER TABLE public."referralRewards" ADD CONSTRAINT fk_ref_rewards_referred FOREIGN KEY ("referredInvestorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ref_rewards_deposit') THEN
    ALTER TABLE public."referralRewards" ADD CONSTRAINT fk_ref_rewards_deposit FOREIGN KEY ("qualifyingDepositId") REFERENCES public."deposits"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ref_withdrawals_investor') THEN
    ALTER TABLE public."referralWithdrawals" ADD CONSTRAINT fk_ref_withdrawals_investor FOREIGN KEY ("investorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_investor_accounts_user') THEN
    ALTER TABLE public."investorAccounts" ADD CONSTRAINT fk_investor_accounts_user FOREIGN KEY ("investorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_investor_accounts_plan') THEN
    ALTER TABLE public."investorAccounts" ADD CONSTRAINT fk_investor_accounts_plan FOREIGN KEY ("planId") REFERENCES public."plans"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_roi_investor') THEN
    ALTER TABLE public."roiEntries" ADD CONSTRAINT fk_roi_investor FOREIGN KEY ("investorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_roi_plan') THEN
    ALTER TABLE public."roiEntries" ADD CONSTRAINT fk_roi_plan FOREIGN KEY ("planId") REFERENCES public."plans"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ledger_investor') THEN
    ALTER TABLE public."portfolioLedger" ADD CONSTRAINT fk_ledger_investor FOREIGN KEY ("investorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_withdrawals_investor') THEN
    ALTER TABLE public."investorWithdrawals" ADD CONSTRAINT fk_withdrawals_investor FOREIGN KEY ("investorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_holdings_investor') THEN
    ALTER TABLE public."portfolioHoldings" ADD CONSTRAINT fk_holdings_investor FOREIGN KEY ("investorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_alloc_investor') THEN
    ALTER TABLE public."copyAllocations" ADD CONSTRAINT fk_alloc_investor FOREIGN KEY ("investorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_alloc_trader') THEN
    ALTER TABLE public."copyAllocations" ADD CONSTRAINT fk_alloc_trader FOREIGN KEY ("traderId") REFERENCES public."traders"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_user') THEN
    ALTER TABLE public."notifications" ADD CONSTRAINT fk_notifications_user FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_swap_investor') THEN
    ALTER TABLE public."swapTransactions" ADD CONSTRAINT fk_swap_investor FOREIGN KEY ("investorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_push_user') THEN
    ALTER TABLE public."pushSubscriptions" ADD CONSTRAINT fk_push_user FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_recovery_user') THEN
    ALTER TABLE public."recoveryCodes" ADD CONSTRAINT fk_recovery_user FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_actor') THEN
    ALTER TABLE public."auditLog" ADD CONSTRAINT fk_audit_actor FOREIGN KEY ("actorId") REFERENCES public."users"("id") ON DELETE CASCADE;
  END IF;
END
$$;

-- ── Seed Plans ─────────────────────────────────────────────────
-- Fixed-plan tiers. Assign-Plan credits the plan amount (minimumDepositCents).
-- Matches the live production values.

INSERT INTO "plans" ("name", "minimumDepositCents", "maximumDepositCents", "minRoiBps", "maxRoiBps", "active")
VALUES
  ('Starter', 150000, NULL, 1500, 1500, 1),
  ('Growth', 750000, NULL, 2500, 2500, 1),
  ('Elite', 4500000, NULL, 3500, 3500, 1)
ON CONFLICT DO NOTHING;

-- ── Supabase security policies ─────────────────────────────────
-- Safe to re-run: existing policies are replaced with the canonical definitions.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public."users" WHERE id = auth.uid()::text AND role = 'admin');
$$;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."investorAccounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portfolioLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."roiEntries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."referralLinks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."referralAttributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."referralRewards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."referralWithdrawals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deposits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."depositInstructions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."kycApplications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."investorWithdrawals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."traders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platformSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."auditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rateLimits" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS users_self_read ON public."users";
  CREATE POLICY users_self_read ON public."users" FOR SELECT USING (id = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS users_self_update ON public."users";
  CREATE POLICY users_self_update ON public."users" FOR UPDATE USING (id = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS investor_account_self_read ON public."investorAccounts";
  CREATE POLICY investor_account_self_read ON public."investorAccounts" FOR SELECT USING ("investorId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS ledger_self_read ON public."portfolioLedger";
  CREATE POLICY ledger_self_read ON public."portfolioLedger" FOR SELECT USING ("investorId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS roi_self_read ON public."roiEntries";
  CREATE POLICY roi_self_read ON public."roiEntries" FOR SELECT USING ("investorId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS referral_links_self_access ON public."referralLinks";
  CREATE POLICY referral_links_self_access ON public."referralLinks" FOR ALL USING ("ownerId" = auth.uid()::text OR public.is_admin()) WITH CHECK ("ownerId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS referral_attribution_participant_read ON public."referralAttributions";
  CREATE POLICY referral_attribution_participant_read ON public."referralAttributions" FOR SELECT USING ("referrerId" = auth.uid()::text OR "referredInvestorId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS referral_reward_participant_read ON public."referralRewards";
  CREATE POLICY referral_reward_participant_read ON public."referralRewards" FOR SELECT USING ("referrerId" = auth.uid()::text OR "referredInvestorId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS referral_withdrawal_owner_access ON public."referralWithdrawals";
  CREATE POLICY referral_withdrawal_owner_access ON public."referralWithdrawals" FOR ALL USING ("investorId" = auth.uid()::text OR public.is_admin()) WITH CHECK ("investorId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS notifications_owner_read ON public."notifications";
  CREATE POLICY notifications_owner_read ON public."notifications" FOR SELECT USING ("userId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS deposits_owner_read ON public."deposits";
  CREATE POLICY deposits_owner_read ON public."deposits" FOR SELECT USING ("investorId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS deposit_instructions_authenticated_read ON public."depositInstructions";
  CREATE POLICY deposit_instructions_authenticated_read ON public."depositInstructions" FOR SELECT USING (auth.uid() IS NOT NULL AND active = 1 OR public.is_admin());
  DROP POLICY IF EXISTS kyc_owner_access ON public."kycApplications";
  CREATE POLICY kyc_owner_access ON public."kycApplications" FOR ALL USING ("investorId" = auth.uid()::text OR public.is_admin()) WITH CHECK ("investorId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS investor_withdrawal_owner_access ON public."investorWithdrawals";
  CREATE POLICY investor_withdrawal_owner_access ON public."investorWithdrawals" FOR ALL USING ("investorId" = auth.uid()::text OR public.is_admin()) WITH CHECK ("investorId" = auth.uid()::text OR public.is_admin());
  DROP POLICY IF EXISTS traders_authenticated_read ON public."traders";
  CREATE POLICY traders_authenticated_read ON public."traders" FOR SELECT USING (auth.uid() IS NOT NULL);
  DROP POLICY IF EXISTS plans_authenticated_read ON public."plans";
  CREATE POLICY plans_authenticated_read ON public."plans" FOR SELECT USING (auth.uid() IS NOT NULL AND active = 1);
  DROP POLICY IF EXISTS platform_settings_admin_access ON public."platformSettings";
  CREATE POLICY platform_settings_admin_access ON public."platformSettings" FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS audit_log_admin_access ON public."auditLog";
  CREATE POLICY audit_log_admin_access ON public."auditLog" FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
END
$$;

-- ── Private media bucket and policies ───────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('quantovest-media', 'quantovest-media', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  DROP POLICY IF EXISTS media_owner_read ON storage.objects;
  CREATE POLICY media_owner_read ON storage.objects FOR SELECT USING (bucket_id = 'quantovest-media' AND (storage.foldername(name))[2] = auth.uid()::text);
  DROP POLICY IF EXISTS media_owner_insert ON storage.objects;
  CREATE POLICY media_owner_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'quantovest-media' AND (storage.foldername(name))[2] = auth.uid()::text);
  DROP POLICY IF EXISTS media_owner_update ON storage.objects;
  CREATE POLICY media_owner_update ON storage.objects FOR UPDATE USING (bucket_id = 'quantovest-media' AND (storage.foldername(name))[2] = auth.uid()::text);
  DROP POLICY IF EXISTS media_owner_delete ON storage.objects;
  CREATE POLICY media_owner_delete ON storage.objects FOR DELETE USING (bucket_id = 'quantovest-media' AND (storage.foldername(name))[2] = auth.uid()::text);
  DROP POLICY IF EXISTS media_admin_read ON storage.objects;
  CREATE POLICY media_admin_read ON storage.objects FOR SELECT USING (bucket_id = 'quantovest-media' AND public.is_admin());
END
$$;

-- ── Repair: bring older databases up to the current users schema ──
-- Safe to run repeatedly. Ensures a stale DB (e.g. one created before the
-- columns below existed) matches install time even after CREATE TABLE IF NOT EXISTS
-- already ran. The live production DB was drifted on these columns; this is the fix.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "onboardingCompleted" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "onboardingAnswers" json,
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "twoFactorSecret" text,
  ADD COLUMN IF NOT EXISTS "payoutDetails" json,
  ADD COLUMN IF NOT EXISTS "notificationPrefs" json;

-- Investors are only placed on a plan once their total deposit meets a plan
-- minimum; planId is NULL (no plan) until then.
ALTER TABLE public."investorAccounts" ALTER COLUMN "planId" DROP NOT NULL;
UPDATE public."investorAccounts" SET "planId" = NULL
WHERE "planId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.plans p
                  WHERE p.id = "investorAccounts"."planId"
                    AND p."minimumDepositCents" <= "investorAccounts"."principalCents");
