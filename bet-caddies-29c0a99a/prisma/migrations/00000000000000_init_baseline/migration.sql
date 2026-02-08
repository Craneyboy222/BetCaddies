-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_events" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tour" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "courseLat" DOUBLE PRECISION,
    "courseLng" DOUBLE PRECISION,
    "sourceUrls" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" JSONB NOT NULL,
    "country" TEXT,
    "tourIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_entries" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tourEventId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tee_times" (
    "id" TEXT NOT NULL,
    "tourEventId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "playerId" TEXT,
    "teeTimeUtc" TIMESTAMP(3) NOT NULL,
    "tee" TEXT NOT NULL,
    "groupMeta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tee_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "par" INTEGER,
    "yardage" INTEGER,
    "typeTags" JSONB NOT NULL,
    "notes" TEXT,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_forecasts" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tourEventId" TEXT NOT NULL,
    "forecastJson" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tourEventId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "leaderboardJson" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_events" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tourEventId" TEXT NOT NULL,
    "oddsProvider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_markets" (
    "id" TEXT NOT NULL,
    "oddsEventId" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_offers" (
    "id" TEXT NOT NULL,
    "oddsMarketId" TEXT NOT NULL,
    "selectionName" TEXT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "oddsDecimal" DOUBLE PRECISION NOT NULL,
    "oddsDisplay" TEXT NOT NULL,
    "deepLink" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "tourEventId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "probsJson" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_recommendations" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "tourEventId" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "confidence1To5" INTEGER NOT NULL,
    "bestBookmaker" TEXT NOT NULL,
    "bestOdds" DOUBLE PRECISION NOT NULL,
    "altOffersJson" JSONB NOT NULL,
    "analysisParagraph" TEXT NOT NULL,
    "analysisBullets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bet_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_issues" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tour" TEXT,
    "severity" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "evidenceJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "runs_runKey_key" ON "runs"("runKey");

-- CreateIndex
CREATE UNIQUE INDEX "tour_events_runId_tour_key" ON "tour_events"("runId", "tour");

-- CreateIndex
CREATE UNIQUE INDEX "players_canonicalName_key" ON "players"("canonicalName");

-- CreateIndex
CREATE UNIQUE INDEX "field_entries_tourEventId_playerId_key" ON "field_entries"("tourEventId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "courses_name_key" ON "courses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "odds_offers_oddsMarketId_selectionName_bookmaker_key" ON "odds_offers"("oddsMarketId", "selectionName", "bookmaker");

-- AddForeignKey
ALTER TABLE "tour_events" ADD CONSTRAINT "tour_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_entries" ADD CONSTRAINT "field_entries_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_entries" ADD CONSTRAINT "field_entries_tourEventId_fkey" FOREIGN KEY ("tourEventId") REFERENCES "tour_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_entries" ADD CONSTRAINT "field_entries_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tee_times" ADD CONSTRAINT "tee_times_tourEventId_fkey" FOREIGN KEY ("tourEventId") REFERENCES "tour_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tee_times" ADD CONSTRAINT "tee_times_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weather_forecasts" ADD CONSTRAINT "weather_forecasts_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weather_forecasts" ADD CONSTRAINT "weather_forecasts_tourEventId_fkey" FOREIGN KEY ("tourEventId") REFERENCES "tour_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_tourEventId_fkey" FOREIGN KEY ("tourEventId") REFERENCES "tour_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_events" ADD CONSTRAINT "odds_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_events" ADD CONSTRAINT "odds_events_tourEventId_fkey" FOREIGN KEY ("tourEventId") REFERENCES "tour_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_markets" ADD CONSTRAINT "odds_markets_oddsEventId_fkey" FOREIGN KEY ("oddsEventId") REFERENCES "odds_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_offers" ADD CONSTRAINT "odds_offers_oddsMarketId_fkey" FOREIGN KEY ("oddsMarketId") REFERENCES "odds_markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_tourEventId_fkey" FOREIGN KEY ("tourEventId") REFERENCES "tour_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_recommendations" ADD CONSTRAINT "bet_recommendations_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_recommendations" ADD CONSTRAINT "bet_recommendations_tourEventId_fkey" FOREIGN KEY ("tourEventId") REFERENCES "tour_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_issues" ADD CONSTRAINT "data_issues_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

