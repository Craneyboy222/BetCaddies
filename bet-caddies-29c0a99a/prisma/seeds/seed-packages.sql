-- Seed 3 membership packages for BetCaddies
-- Run via: psql $DATABASE_URL -f this_file.sql
-- Or Prisma will pick them up if referenced in seed scripts

INSERT INTO membership_packages (id, name, description, price, "billingPeriod", features, badges, "stripePriceId", "displayOrder", enabled, "createdAt", "stripeProductId", "accessLevel", "trialDays", popular)
VALUES
(
  'pkg_par_monthly',
  'Par',
  'Perfect for casual golf punters who want an edge. Get weekly value picks backed by data — not gut feeling.',
  9.99,
  'month',
  '["3-5 Par Tier picks every week", "AI-powered selection analysis", "Best odds comparison across bookmakers", "Course fit ratings for every pick", "Weekly results recap with P&L tracking", "Email alerts for new picks"]'::jsonb,
  '[{"text": "Great Value", "color": "emerald"}]'::jsonb,
  NULL,
  1,
  true,
  NOW(),
  NULL,
  'free',
  7,
  false
),
(
  'pkg_birdie_monthly',
  'Birdie',
  'For serious bettors who want the full picture. Unlock mid-range value plays and deeper analysis to sharpen every decision.',
  19.99,
  'month',
  '["Everything in Par, plus...", "5-8 Birdie Tier picks every week", "Matchup & head-to-head betting picks", "Fair probability & edge % on every bet", "Odds movement alerts & market signals", "Live bet tracking dashboard", "Priority access to new features"]'::jsonb,
  '[{"text": "Most Popular", "color": "emerald"}, {"text": "Best Value", "color": "blue"}]'::jsonb,
  NULL,
  2,
  true,
  NOW(),
  NULL,
  'pro',
  7,
  true
),
(
  'pkg_eagle_monthly',
  'Eagle',
  'The ultimate edge. High-conviction longshots, exclusive insights, and every tool we build — before anyone else sees it.',
  34.99,
  'month',
  '["Everything in Birdie, plus...", "3-5 Eagle Tier high-value longshots weekly", "The Long Shots — curated moonshot picks", "Full confidence ratings (1-5 stars)", "Detailed course fit & form breakdowns", "Exclusive Hole-in-One Challenge entry", "VIP Discord community access", "Export your betting history & analytics"]'::jsonb,
  '[{"text": "Premium", "color": "amber"}, {"text": "All Access", "color": "purple"}]'::jsonb,
  NULL,
  3,
  true,
  NOW(),
  NULL,
  'elite',
  7,
  false
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  badges = EXCLUDED.badges,
  "displayOrder" = EXCLUDED."displayOrder",
  "accessLevel" = EXCLUDED."accessLevel",
  "trialDays" = EXCLUDED."trialDays",
  popular = EXCLUDED.popular;
