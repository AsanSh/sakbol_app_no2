-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "email" TEXT,
ADD COLUMN "passwordHash" TEXT;

CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

-- CreateTable
CREATE TABLE "TelegramLinkCode" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramLinkCode_code_expiresAt_idx" ON "TelegramLinkCode"("code", "expiresAt");
CREATE INDEX "TelegramLinkCode_profileId_createdAt_idx" ON "TelegramLinkCode"("profileId", "createdAt");

ALTER TABLE "TelegramLinkCode" ADD CONSTRAINT "TelegramLinkCode_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
