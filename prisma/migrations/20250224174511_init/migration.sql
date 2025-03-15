/*
  Warnings:

  - A unique constraint covering the columns `[sessionId]` on the table `LiveMessage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sessionId` to the `LiveMessage` table without a default value. This is not possible if the table is not empty.
  - Made the column `startedAt` on table `StreamSession` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "LiveMessage" ADD COLUMN     "sessionId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "StreamSession" ALTER COLUMN "startedAt" SET NOT NULL,
ALTER COLUMN "startedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "LiveMessage_sessionId_key" ON "LiveMessage"("sessionId");

-- AddForeignKey
ALTER TABLE "LiveMessage" ADD CONSTRAINT "LiveMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StreamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
