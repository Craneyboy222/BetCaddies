-- Add Stripe linkage fields for memberships
ALTER TABLE "membership_packages"
ADD COLUMN IF NOT EXISTS "stripeProductId" TEXT;

ALTER TABLE "membership_subscriptions"
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "membership_subscriptions_stripeSubscriptionId_key"
ON "membership_subscriptions"("stripeSubscriptionId");
