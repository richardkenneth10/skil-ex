/*
  Warnings:

  - You are about to drop the column `duration` on the `StreamSession` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "StreamSession" DROP COLUMN "duration";

-- CreateIndex
CREATE INDEX "StreamSession_endedAt_idx" ON "StreamSession"("endedAt");
