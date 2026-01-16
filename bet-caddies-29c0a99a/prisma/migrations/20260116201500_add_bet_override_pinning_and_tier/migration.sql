-- AlterTable
ALTER TABLE "bet_overrides"
  ADD COLUMN "tierOverride" TEXT,
  ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pinOrder" INTEGER;
