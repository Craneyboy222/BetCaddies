-- Live tracking linkage fields
ALTER TABLE "tour_events"
ADD COLUMN IF NOT EXISTS "dg_event_id" TEXT;

CREATE INDEX IF NOT EXISTS "tour_events_dg_event_id_idx"
ON "tour_events"("dg_event_id");

ALTER TABLE "bet_recommendations"
ADD COLUMN IF NOT EXISTS "dg_player_id" TEXT;

-- Baseline odds storage for live tracking
CREATE TABLE IF NOT EXISTS "live_tracking_baselines" (
  "id" TEXT NOT NULL,
  "bet_recommendation_id" TEXT NOT NULL,
  "baseline_odds_decimal" DOUBLE PRECISION NOT NULL,
  "baseline_book" TEXT,
  "captured_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_tracking_baselines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "live_tracking_baselines_bet_recommendation_id_key"
ON "live_tracking_baselines"("bet_recommendation_id");

ALTER TABLE "live_tracking_baselines"
ADD CONSTRAINT "live_tracking_baselines_bet_recommendation_id_fkey"
FOREIGN KEY ("bet_recommendation_id") REFERENCES "bet_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
