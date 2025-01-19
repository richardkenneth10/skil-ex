-- CreateTable
CREATE TABLE "StreamSession" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "channelId" TEXT NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "learnerId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamLog" (
    "streamId" INTEGER NOT NULL,
    "matchId" INTEGER NOT NULL,
    "channelId" TEXT NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "learnerId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamLog_pkey" PRIMARY KEY ("streamId")
);

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "SkillMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamLog" ADD CONSTRAINT "StreamLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "SkillMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamLog" ADD CONSTRAINT "StreamLog_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamLog" ADD CONSTRAINT "StreamLog_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
