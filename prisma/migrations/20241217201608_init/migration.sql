/*
  Warnings:

  - A unique constraint covering the columns `[senderId,senderSkillId,receiverId,receiverSkillId,completedAt]` on the table `SkillMatch` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "SkillMatch_senderId_senderSkillId_receiverId_receiverSkillI_key";

-- CreateIndex
CREATE UNIQUE INDEX "SkillMatch_senderId_senderSkillId_receiverId_receiverSkillI_key" ON "SkillMatch"("senderId", "senderSkillId", "receiverId", "receiverSkillId", "completedAt");
