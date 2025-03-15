/*
  Warnings:

  - You are about to drop the column `content` on the `ChatMessage` table. All the data in the column will be lost.
  - Added the required column `type` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoomChatMessageType" AS ENUM ('TEXT', 'LIVE');

-- AlterTable
ALTER TABLE "ChatMessage" DROP COLUMN "content",
ADD COLUMN     "type" "RoomChatMessageType" NOT NULL;

-- AlterTable
ALTER TABLE "StreamSession" ALTER COLUMN "startedAt" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TextMessage" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,

    CONSTRAINT "TextMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveMessage" (
    "id" SERIAL NOT NULL,
    "channelId" TEXT NOT NULL,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "messageId" INTEGER NOT NULL,

    CONSTRAINT "LiveMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TextMessage_messageId_key" ON "TextMessage"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveMessage_messageId_key" ON "LiveMessage"("messageId");

-- AddForeignKey
ALTER TABLE "TextMessage" ADD CONSTRAINT "TextMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveMessage" ADD CONSTRAINT "LiveMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
