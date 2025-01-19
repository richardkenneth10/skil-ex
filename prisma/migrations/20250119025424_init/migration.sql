/*
  Warnings:

  - A unique constraint covering the columns `[channelId]` on the table `StreamLog` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[channelId]` on the table `StreamSession` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "StreamLog_channelId_key" ON "StreamLog"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "StreamSession_channelId_key" ON "StreamSession"("channelId");
