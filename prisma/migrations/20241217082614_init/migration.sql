-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'COMPLETED');

-- CreateTable
CREATE TABLE "SkillMatch" (
    "id" SERIAL NOT NULL,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "senderSkillId" INTEGER NOT NULL,
    "receiverSkillId" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillMatch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SkillMatch" ADD CONSTRAINT "SkillMatch_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMatch" ADD CONSTRAINT "SkillMatch_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMatch" ADD CONSTRAINT "SkillMatch_senderSkillId_fkey" FOREIGN KEY ("senderSkillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMatch" ADD CONSTRAINT "SkillMatch_receiverSkillId_fkey" FOREIGN KEY ("receiverSkillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
