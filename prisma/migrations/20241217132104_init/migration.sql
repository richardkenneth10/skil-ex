/*
  Warnings:

  - You are about to drop the `UserSkill` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserSkill" DROP CONSTRAINT "UserSkill_skillId_fkey";

-- DropForeignKey
ALTER TABLE "UserSkill" DROP CONSTRAINT "UserSkill_userId_fkey";

-- DropTable
DROP TABLE "UserSkill";

-- DropEnum
DROP TYPE "UserSkillType";

-- CreateTable
CREATE TABLE "UserSkillOffered" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "canMatch" BOOLEAN NOT NULL DEFAULT true,
    "exchangeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkillOffered_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkillWanted" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "canMatch" BOOLEAN NOT NULL DEFAULT true,
    "exchangeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkillWanted_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSkillOffered_userId_skillId_key" ON "UserSkillOffered"("userId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkillWanted_userId_skillId_key" ON "UserSkillWanted"("userId", "skillId");

-- AddForeignKey
ALTER TABLE "UserSkillOffered" ADD CONSTRAINT "UserSkillOffered_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkillOffered" ADD CONSTRAINT "UserSkillOffered_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkillWanted" ADD CONSTRAINT "UserSkillWanted_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkillWanted" ADD CONSTRAINT "UserSkillWanted_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
