-- AlterTable
ALTER TABLE "ProfileAccess" ADD COLUMN "pendingTelegramUserId" TEXT;

-- CreateIndex
CREATE INDEX "ProfileAccess_pendingTelegramUserId_idx" ON "ProfileAccess"("pendingTelegramUserId");
