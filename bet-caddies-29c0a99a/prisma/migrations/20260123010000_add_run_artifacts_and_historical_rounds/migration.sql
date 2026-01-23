-- Create run_artifacts table
CREATE TABLE IF NOT EXISTS "run_artifacts" (
  "id" TEXT PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "tour" TEXT,
  "endpoint" TEXT NOT NULL,
  "paramsJson" JSONB NOT NULL,
  "payloadJson" JSONB,
  "payloadHash" TEXT,
  "payloadBytes" INTEGER,
  "artifactRef" TEXT,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "run_artifacts_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "run_artifacts_runId_idx" ON "run_artifacts" ("runId");

-- Create historical_rounds table
CREATE TABLE IF NOT EXISTS "historical_rounds" (
  "id" TEXT PRIMARY KEY,
  "tour" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "playerId" TEXT NOT NULL,
  "round" INTEGER NOT NULL,
  "statsJson" JSONB NOT NULL,
  "strokesGainedJson" JSONB,
  "teeTimeUtc" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "historical_rounds_tour_eventId_year_idx" ON "historical_rounds" ("tour", "eventId", "year");
CREATE INDEX IF NOT EXISTS "historical_rounds_playerId_idx" ON "historical_rounds" ("playerId");
