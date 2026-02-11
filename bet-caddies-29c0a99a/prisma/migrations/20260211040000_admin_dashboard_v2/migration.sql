-- Analytics Events
CREATE TABLE IF NOT EXISTS "analytics_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "sessionId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "pageUrl" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "analytics_events_eventType_createdAt_idx" ON "analytics_events"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "analytics_events_userId_idx" ON "analytics_events"("userId");
CREATE INDEX IF NOT EXISTS "analytics_events_anonymousId_idx" ON "analytics_events"("anonymousId");
CREATE INDEX IF NOT EXISTS "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");

-- Coupons
CREATE TABLE IF NOT EXISTS "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "minOrderAmount" DOUBLE PRECISION,
    "applicablePackages" JSONB,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "stripeCouponId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_key" ON "coupons"("code");
CREATE INDEX IF NOT EXISTS "coupons_code_idx" ON "coupons"("code");
CREATE INDEX IF NOT EXISTS "coupons_enabled_validFrom_validUntil_idx" ON "coupons"("enabled", "validFrom", "validUntil");

-- Coupon Redemptions
CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "discountApplied" DOUBLE PRECISION NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "coupon_redemptions_couponId_idx" ON "coupon_redemptions"("couponId");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_userEmail_idx" ON "coupon_redemptions"("userEmail");
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Referrals
CREATE TABLE IF NOT EXISTS "referrals" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "totalReferrals" INTEGER NOT NULL DEFAULT 0,
    "totalConversions" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referralCode_key" ON "referrals"("referralCode");
CREATE INDEX IF NOT EXISTS "referrals_referrerUserId_idx" ON "referrals"("referrerUserId");
CREATE INDEX IF NOT EXISTS "referrals_referralCode_idx" ON "referrals"("referralCode");

-- Referral Clicks
CREATE TABLE IF NOT EXISTS "referral_clicks" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "convertedUserId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_clicks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "referral_clicks_referralId_idx" ON "referral_clicks"("referralId");
ALTER TABLE "referral_clicks" ADD CONSTRAINT "referral_clicks_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Scheduled Publishes
CREATE TABLE IF NOT EXISTS "scheduled_publishes" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scheduled_publishes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "scheduled_publishes_status_scheduledFor_idx" ON "scheduled_publishes"("status", "scheduledFor");

-- Webhook Configs
CREATE TABLE IF NOT EXISTS "webhook_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "headers" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 3,
    "lastTriggeredAt" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhook_configs_pkey" PRIMARY KEY ("id")
);

-- Webhook Deliveries
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhookId_createdAt_idx" ON "webhook_deliveries"("webhookId", "createdAt");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_idx" ON "webhook_deliveries"("status");

-- System Health Logs
CREATE TABLE IF NOT EXISTS "system_health_logs" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ms',
    "endpoint" TEXT,
    "metadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_health_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "system_health_logs_metric_recordedAt_idx" ON "system_health_logs"("metric", "recordedAt");

-- Email Templates
CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "variables" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_slug_key" ON "email_templates"("slug");

-- Email Sends
CREATE TABLE IF NOT EXISTS "email_sends" (
    "id" TEXT NOT NULL,
    "templateSlug" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "providerMsgId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "email_sends_toEmail_idx" ON "email_sends"("toEmail");
CREATE INDEX IF NOT EXISTS "email_sends_status_createdAt_idx" ON "email_sends"("status", "createdAt");
