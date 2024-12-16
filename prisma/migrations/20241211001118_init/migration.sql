/*
  Warnings:

  - A unique constraint covering the columns `[userId,deviceInfo]` on the table `Token` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Token_userId_deviceInfo_key" ON "Token"("userId", "deviceInfo");
