/*
  Warnings:

  - You are about to drop the `_UserOfferedSkills` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_UserWantedSkills` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[senderId,senderSkillId,receiverId,receiverSkillId,status]` on the table `SkillMatch` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserSkillType" AS ENUM ('OFFERED', 'WANTED');

-- DropForeignKey
ALTER TABLE "_UserOfferedSkills" DROP CONSTRAINT "_UserOfferedSkills_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserOfferedSkills" DROP CONSTRAINT "_UserOfferedSkills_B_fkey";

-- DropForeignKey
ALTER TABLE "_UserWantedSkills" DROP CONSTRAINT "_UserWantedSkills_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserWantedSkills" DROP CONSTRAINT "_UserWantedSkills_B_fkey";

-- DropTable
DROP TABLE "_UserOfferedSkills";

-- DropTable
DROP TABLE "_UserWantedSkills";

-- CreateTable
CREATE TABLE "UserSkill" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "type" "UserSkillType" NOT NULL,
    "canMatch" BOOLEAN NOT NULL DEFAULT true,
    "exchangeCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSkill_userId_skillId_type_key" ON "UserSkill"("userId", "skillId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMatch_senderId_senderSkillId_receiverId_receiverSkillI_key" ON "SkillMatch"("senderId", "senderSkillId", "receiverId", "receiverSkillId", "status");

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
