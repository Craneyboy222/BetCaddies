-- CreateTable
CREATE TABLE "hio_challenges" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "prizeDescription" TEXT,
    "tournamentNames" JSONB,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "totalEntries" INTEGER NOT NULL DEFAULT 0,
    "perfectScores" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hio_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hio_entries" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,
    "isPerfect" BOOLEAN,

    CONSTRAINT "hio_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hio_challenges_status_idx" ON "hio_challenges"("status");

-- CreateIndex
CREATE UNIQUE INDEX "hio_entries_challengeId_userEmail_key" ON "hio_entries"("challengeId", "userEmail");

-- CreateIndex
CREATE INDEX "hio_entries_userEmail_idx" ON "hio_entries"("userEmail");

-- AddForeignKey
ALTER TABLE "hio_entries" ADD CONSTRAINT "hio_entries_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "hio_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
