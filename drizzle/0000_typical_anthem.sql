CREATE TABLE "accounts" (
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
--> statement-breakpoint
CREATE TABLE "auditLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"actorId" varchar(191) NOT NULL,
	"action" varchar(64) NOT NULL,
	"targetType" varchar(64) NOT NULL,
	"targetId" varchar(191) NOT NULL,
	"details" json,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copyAllocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"traderId" varchar(191) NOT NULL,
	"allocationCents" integer DEFAULT 0 NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "depositInstructions" (
	"id" serial PRIMARY KEY NOT NULL,
	"method" varchar(16) NOT NULL,
	"label" varchar(120) NOT NULL,
	"details" text NOT NULL,
	"qrPath" text,
	"active" integer DEFAULT 1 NOT NULL,
	"updatedBy" varchar(191) NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
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
--> statement-breakpoint
CREATE TABLE "investorAccounts" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"planId" integer,
	"principalCents" integer DEFAULT 0 NOT NULL,
	"balanceCents" integer DEFAULT 0 NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investorWithdrawals" (
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
--> statement-breakpoint
CREATE TABLE "kycApplications" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"documentPath" text NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"reviewedBy" varchar(191),
	"reviewNote" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" varchar(191) NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"relatedRewardId" integer,
	"isRead" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"minimumDepositCents" integer NOT NULL,
	"maximumDepositCents" integer,
	"minRoiBps" integer NOT NULL,
	"maxRoiBps" integer NOT NULL,
	"active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platformSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"settingKey" varchar(64) NOT NULL,
	"settingValue" json NOT NULL,
	"updatedBy" varchar(191) NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolioHoldings" (
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
--> statement-breakpoint
CREATE TABLE "portfolioLedger" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"type" varchar(32) NOT NULL,
	"amountCents" integer NOT NULL,
	"referenceId" varchar(191),
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pushSubscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" varchar(191) NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"userAgent" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rateLimits" (
	"key" varchar(191) PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"windowStarted" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recoveryCodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" varchar(191) NOT NULL,
	"codeHash" varchar(64) NOT NULL,
	"usedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referralAttributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrerId" varchar(191) NOT NULL,
	"referredInvestorId" varchar(191) NOT NULL,
	"linkId" integer NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"attributedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referralLinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" varchar(191) NOT NULL,
	"code" varchar(64) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referralRewards" (
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
--> statement-breakpoint
CREATE TABLE "referralWithdrawals" (
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
--> statement-breakpoint
CREATE TABLE "roiEntries" (
	"id" serial PRIMARY KEY NOT NULL,
	"investorId" varchar(191) NOT NULL,
	"planId" integer,
	"percentageBps" integer NOT NULL,
	"profitCents" integer NOT NULL,
	"marketNote" text NOT NULL,
	"publishedBy" varchar(191) NOT NULL,
	"entryDate" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(191) NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swapConfig" (
	"id" serial PRIMARY KEY NOT NULL,
	"fromAsset" varchar(16) NOT NULL,
	"toAsset" varchar(16) NOT NULL,
	"rateMultiplier" varchar(32) DEFAULT '1' NOT NULL,
	"feeBps" integer DEFAULT 50 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swapTransactions" (
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
--> statement-breakpoint
CREATE TABLE "traders" (
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
--> statement-breakpoint
CREATE TABLE "users" (
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
--> statement-breakpoint
CREATE TABLE "verificationTokens" (
	"identifier" varchar(191) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verificationTokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditLog" ADD CONSTRAINT "auditLog_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyAllocations" ADD CONSTRAINT "copyAllocations_investorId_users_id_fk" FOREIGN KEY ("investorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyAllocations" ADD CONSTRAINT "copyAllocations_traderId_traders_id_fk" FOREIGN KEY ("traderId") REFERENCES "public"."traders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_investorId_users_id_fk" FOREIGN KEY ("investorId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_planId_plans_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investorAccounts" ADD CONSTRAINT "investorAccounts_investorId_users_id_fk" FOREIGN KEY ("investorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investorAccounts" ADD CONSTRAINT "investorAccounts_planId_plans_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investorWithdrawals" ADD CONSTRAINT "investorWithdrawals_investorId_users_id_fk" FOREIGN KEY ("investorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kycApplications" ADD CONSTRAINT "kycApplications_investorId_users_id_fk" FOREIGN KEY ("investorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolioHoldings" ADD CONSTRAINT "portfolioHoldings_investorId_users_id_fk" FOREIGN KEY ("investorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolioLedger" ADD CONSTRAINT "portfolioLedger_investorId_users_id_fk" FOREIGN KEY ("investorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pushSubscriptions" ADD CONSTRAINT "pushSubscriptions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recoveryCodes" ADD CONSTRAINT "recoveryCodes_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralAttributions" ADD CONSTRAINT "referralAttributions_referrerId_users_id_fk" FOREIGN KEY ("referrerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralAttributions" ADD CONSTRAINT "referralAttributions_referredInvestorId_users_id_fk" FOREIGN KEY ("referredInvestorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralAttributions" ADD CONSTRAINT "referralAttributions_linkId_referralLinks_id_fk" FOREIGN KEY ("linkId") REFERENCES "public"."referralLinks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralLinks" ADD CONSTRAINT "referralLinks_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralRewards" ADD CONSTRAINT "referralRewards_attributionId_referralAttributions_id_fk" FOREIGN KEY ("attributionId") REFERENCES "public"."referralAttributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralRewards" ADD CONSTRAINT "referralRewards_referrerId_users_id_fk" FOREIGN KEY ("referrerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralRewards" ADD CONSTRAINT "referralRewards_referredInvestorId_users_id_fk" FOREIGN KEY ("referredInvestorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralRewards" ADD CONSTRAINT "referralRewards_qualifyingDepositId_deposits_id_fk" FOREIGN KEY ("qualifyingDepositId") REFERENCES "public"."deposits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralWithdrawals" ADD CONSTRAINT "referralWithdrawals_investorId_users_id_fk" FOREIGN KEY ("investorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roiEntries" ADD CONSTRAINT "roiEntries_investorId_users_id_fk" FOREIGN KEY ("investorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roiEntries" ADD CONSTRAINT "roiEntries_planId_plans_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swapTransactions" ADD CONSTRAINT "swapTransactions_investorId_users_id_fk" FOREIGN KEY ("investorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "auditLog" USING btree ("actorId");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "auditLog" USING btree ("action");--> statement-breakpoint
CREATE INDEX "copy_allocations_investor_idx" ON "copyAllocations" USING btree ("investorId");--> statement-breakpoint
CREATE INDEX "copy_allocations_trader_idx" ON "copyAllocations" USING btree ("traderId");--> statement-breakpoint
CREATE UNIQUE INDEX "copy_allocations_investor_trader_unique" ON "copyAllocations" USING btree ("investorId","traderId");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_instructions_method_unique" ON "depositInstructions" USING btree ("method");--> statement-breakpoint
CREATE INDEX "deposits_investor_idx" ON "deposits" USING btree ("investorId");--> statement-breakpoint
CREATE INDEX "deposits_status_idx" ON "deposits" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "investor_accounts_investor_unique" ON "investorAccounts" USING btree ("investorId");--> statement-breakpoint
CREATE INDEX "investor_withdrawals_investor_idx" ON "investorWithdrawals" USING btree ("investorId");--> statement-breakpoint
CREATE INDEX "kyc_applications_investor_idx" ON "kycApplications" USING btree ("investorId");--> statement-breakpoint
CREATE INDEX "kyc_applications_status_idx" ON "kycApplications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_settings_key_unique" ON "platformSettings" USING btree ("settingKey");--> statement-breakpoint
CREATE INDEX "portfolio_holdings_investor_idx" ON "portfolioHoldings" USING btree ("investorId");--> statement-breakpoint
CREATE INDEX "portfolio_holdings_symbol_idx" ON "portfolioHoldings" USING btree ("assetSymbol");--> statement-breakpoint
CREATE INDEX "portfolio_ledger_investor_idx" ON "portfolioLedger" USING btree ("investorId");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_ledger_reference_unique" ON "portfolioLedger" USING btree ("type","referenceId");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "pushSubscriptions" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique" ON "pushSubscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "recovery_codes_user_idx" ON "recoveryCodes" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_codes_hash_unique" ON "recoveryCodes" USING btree ("codeHash");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_attributions_referred_unique" ON "referralAttributions" USING btree ("referredInvestorId");--> statement-breakpoint
CREATE INDEX "referral_attributions_referrer_idx" ON "referralAttributions" USING btree ("referrerId");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_links_code_unique" ON "referralLinks" USING btree ("code");--> statement-breakpoint
CREATE INDEX "referral_links_owner_idx" ON "referralLinks" USING btree ("ownerId");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_rewards_key_unique" ON "referralRewards" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "referral_rewards_referrer_idx" ON "referralRewards" USING btree ("referrerId");--> statement-breakpoint
CREATE INDEX "referral_withdrawals_investor_idx" ON "referralWithdrawals" USING btree ("investorId");--> statement-breakpoint
CREATE INDEX "roi_entries_investor_date_idx" ON "roiEntries" USING btree ("investorId","entryDate");--> statement-breakpoint
CREATE INDEX "roi_entries_investor_idx" ON "roiEntries" USING btree ("investorId");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "swap_config_pair_unique" ON "swapConfig" USING btree ("fromAsset","toAsset");--> statement-breakpoint
CREATE INDEX "swap_transactions_investor_idx" ON "swapTransactions" USING btree ("investorId");