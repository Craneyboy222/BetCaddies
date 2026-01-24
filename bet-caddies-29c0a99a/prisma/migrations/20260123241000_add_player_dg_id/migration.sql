ALTER TABLE "players"
  ADD COLUMN "dgId" TEXT;

CREATE UNIQUE INDEX "players_dgId_key" ON "players"("dgId");
