/*
  Warnings:

  - You are about to drop the column `duration` on the `LiveMessage` table. All the data in the column will be lost.
  - You are about to drop the column `endedAt` on the `LiveMessage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LiveMessage" DROP COLUMN "duration",
DROP COLUMN "endedAt";

-- AlterTable
ALTER TABLE "StreamSession" ADD COLUMN     "duration" INTEGER;
