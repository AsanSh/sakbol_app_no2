-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "pinAnchor" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_pinAnchor_key" ON "Profile"("pinAnchor");
