-- CreateTable
CREATE TABLE IF NOT EXISTS "weekly_recaps" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "recapText" TEXT NOT NULL,
    "tournaments" JSONB NOT NULL,
    "statsSnapshot" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_recaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_recaps_weekKey_key" ON "weekly_recaps"("weekKey");
