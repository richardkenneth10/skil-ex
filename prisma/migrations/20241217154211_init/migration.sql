/*
  Warnings:

  - The primary key for the `UserSkillOffered` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `UserSkillOffered` table. All the data in the column will be lost.
  - The primary key for the `UserSkillWanted` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `UserSkillWanted` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserSkillOffered" DROP CONSTRAINT "UserSkillOffered_pkey",
DROP COLUMN "id";

-- AlterTable
ALTER TABLE "UserSkillWanted" DROP CONSTRAINT "UserSkillWanted_pkey",
DROP COLUMN "id";
