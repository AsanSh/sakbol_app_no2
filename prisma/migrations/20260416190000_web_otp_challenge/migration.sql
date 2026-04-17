-- CreateTable
CREATE TABLE "WebOtpChallenge" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebOtpChallenge_telegramUserId_createdAt_idx" ON "WebOtpChallenge"("telegramUserId", "createdAt");
CREATE INDEX "WebOtpChallenge_expiresAt_idx" ON "WebOtpChallenge"("expiresAt");
