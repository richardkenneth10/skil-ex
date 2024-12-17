-- AlterTable
ALTER TABLE "UserSkillOffered" ADD CONSTRAINT "UserSkillOffered_pkey" PRIMARY KEY ("userId", "skillId");

-- DropIndex
DROP INDEX "UserSkillOffered_userId_skillId_key";

-- AlterTable
ALTER TABLE "UserSkillWanted" ADD CONSTRAINT "UserSkillWanted_pkey" PRIMARY KEY ("userId", "skillId");

-- DropIndex
DROP INDEX "UserSkillWanted_userId_skillId_key";
