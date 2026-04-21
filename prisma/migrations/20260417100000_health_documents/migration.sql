-- CreateEnum
CREATE TYPE "HealthDocumentCategory" AS ENUM (
  'ANALYSIS',
  'DISCHARGE_SUMMARY',
  'PROTOCOL',
  'PRESCRIPTION',
  'CONTRACT',
  'OTHER'
);

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "adeskId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_adeskId_key" ON "Profile"("adeskId");

-- CreateTable
CREATE TABLE "HealthDocument" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "category" "HealthDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "documentDate" TIMESTAMP(3),
    "mimeType" TEXT,
    "bytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthDocument_profileId_idx" ON "HealthDocument"("profileId");

-- CreateIndex
CREATE INDEX "HealthDocument_profileId_category_idx" ON "HealthDocument"("profileId", "category");

-- CreateIndex
CREATE INDEX "HealthDocument_createdAt_idx" ON "HealthDocument"("createdAt");

-- AddForeignKey
ALTER TABLE "HealthDocument" ADD CONSTRAINT "HealthDocument_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
