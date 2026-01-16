-- CreateTable
CREATE TABLE "bet_overrides" (
    "id" TEXT NOT NULL,
    "betRecommendationId" TEXT NOT NULL,
    "selectionName" TEXT,
    "betTitle" TEXT,
    "confidenceRating" INTEGER,
    "aiAnalysisParagraph" TEXT,
    "affiliateLinkOverride" TEXT,
    "status" TEXT,
    "courseFitScore" INTEGER,
    "formLabel" TEXT,
    "weatherLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bet_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bet_overrides_betRecommendationId_key" ON "bet_overrides"("betRecommendationId");

-- AddForeignKey
ALTER TABLE "bet_overrides" ADD CONSTRAINT "bet_overrides_betRecommendationId_fkey" FOREIGN KEY ("betRecommendationId") REFERENCES "bet_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
