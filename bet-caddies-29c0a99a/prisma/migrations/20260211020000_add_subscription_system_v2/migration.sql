-- Phase 1: Subscription System V2 Foundation

-- MembershipPackage: add accessLevel, trialDays, popular
ALTER TABLE "membership_packages"
ADD COLUMN IF NOT EXISTS "accessLevel" TEXT NOT NULL DEFAULT 'free';

ALTER TABLE "membership_packages"
ADD COLUMN IF NOT EXISTS "trialDays" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "membership_packages"
ADD COLUMN IF NOT EXISTS "popular" BOOLEAN NOT NULL DEFAULT false;

-- MembershipSubscription: add userId FK, paymentProvider, paypal, dunning fields
ALTER TABLE "membership_subscriptions"
ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "membership_subscriptions"
ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT NOT NULL DEFAULT 'stripe';

ALTER TABLE "membership_subscriptions"
ADD COLUMN IF NOT EXISTS "paypalSubscriptionId" TEXT;

ALTER TABLE "membership_subscriptions"
ADD COLUMN IF NOT EXISTS "failedPaymentCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "membership_subscriptions"
ADD COLUMN IF NOT EXISTS "lastFailedAt" TIMESTAMP(3);

ALTER TABLE "membership_subscriptions"
ADD COLUMN IF NOT EXISTS "dunningStep" INTEGER NOT NULL DEFAULT 0;

-- Add unique constraint on paypalSubscriptionId
CREATE UNIQUE INDEX IF NOT EXISTS "membership_subscriptions_paypalSubscriptionId_key"
ON "membership_subscriptions"("paypalSubscriptionId");

-- Add indexes on userEmail and userId
CREATE INDEX IF NOT EXISTS "membership_subscriptions_userEmail_idx"
ON "membership_subscriptions"("userEmail");

CREATE INDEX IF NOT EXISTS "membership_subscriptions_userId_idx"
ON "membership_subscriptions"("userId");

-- Add FK from subscription to user
ALTER TABLE "membership_subscriptions"
ADD CONSTRAINT "membership_subscriptions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Invoice table
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "userEmail" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "status" TEXT NOT NULL DEFAULT 'paid',
    "paymentProvider" TEXT NOT NULL,
    "providerInvoiceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "invoices_userEmail_idx" ON "invoices"("userEmail");
CREATE INDEX IF NOT EXISTS "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");

ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "membership_subscriptions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- PaymentSettings table (stores provider API keys)
CREATE TABLE IF NOT EXISTS "payment_settings" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'test',
    "publicKey" TEXT,
    "secretKey" TEXT,
    "webhookSecret" TEXT,
    "additionalConfig" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_settings_provider_key"
ON "payment_settings"("provider");

-- ContentAccessRule table (defines what content requires which tier)
CREATE TABLE IF NOT EXISTS "content_access_rules" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceIdentifier" TEXT NOT NULL,
    "minimumAccessLevel" TEXT NOT NULL DEFAULT 'free',
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_access_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_access_rules_resourceType_resourceIdentifier_key"
ON "content_access_rules"("resourceType", "resourceIdentifier");

-- Backfill: link existing subscriptions to users by email
UPDATE "membership_subscriptions" ms
SET "userId" = u."id"
FROM "users" u
WHERE ms."userEmail" = u."email"
AND ms."userId" IS NULL;
