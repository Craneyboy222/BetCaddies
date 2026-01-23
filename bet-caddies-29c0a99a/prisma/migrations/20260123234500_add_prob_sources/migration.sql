ALTER TABLE "bet_recommendations"
  ADD COLUMN "probSource" TEXT,
  ADD COLUMN "marketProbSource" TEXT,
  ADD COLUMN "fallbackType" TEXT;
