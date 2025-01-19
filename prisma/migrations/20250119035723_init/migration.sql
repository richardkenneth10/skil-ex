/*
  Warnings:

  - You are about to drop the column `roomId` on the `StreamLog` table. All the data in the column will be lost.
  - You are about to drop the column `roomId` on the `StreamSession` table. All the data in the column will be lost.
  - Added the required column `exchangeRoomId` to the `StreamLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `exchangeRoomId` to the `StreamSession` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "StreamLog" DROP CONSTRAINT "StreamLog_roomId_fkey";

-- DropForeignKey
ALTER TABLE "StreamSession" DROP CONSTRAINT "StreamSession_roomId_fkey";

-- AlterTable
ALTER TABLE "StreamLog" DROP COLUMN "roomId",
ADD COLUMN     "exchangeRoomId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "StreamSession" DROP COLUMN "roomId",
ADD COLUMN     "exchangeRoomId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_exchangeRoomId_fkey" FOREIGN KEY ("exchangeRoomId") REFERENCES "ExchangeRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamLog" ADD CONSTRAINT "StreamLog_exchangeRoomId_fkey" FOREIGN KEY ("exchangeRoomId") REFERENCES "ExchangeRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
