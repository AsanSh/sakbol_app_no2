-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "telegramUsername" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_telegramUsername_key" ON "Profile"("telegramUsername");
