/*
  Warnings:

  - You are about to drop the column `createdAt` on the `UserSkillOffered` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `UserSkillOffered` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserSkillOffered" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";
