ALTER TABLE "odds_events" ADD COLUMN "match_confidence" DOUBLE PRECISION;
ALTER TABLE "odds_events" ADD COLUMN "match_method" TEXT;

ALTER TABLE "bet_recommendations" ADD COLUMN "mode" TEXT;