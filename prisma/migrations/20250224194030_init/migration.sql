/*
  Warnings:

  - You are about to drop the `StreamLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "StreamLog" DROP CONSTRAINT "StreamLog_exchangeRoomId_fkey";

-- DropForeignKey
ALTER TABLE "StreamLog" DROP CONSTRAINT "StreamLog_learnerId_fkey";

-- DropForeignKey
ALTER TABLE "StreamLog" DROP CONSTRAINT "StreamLog_teacherId_fkey";

-- AlterTable
ALTER TABLE "StreamSession" ADD COLUMN     "endedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "StreamLog";
