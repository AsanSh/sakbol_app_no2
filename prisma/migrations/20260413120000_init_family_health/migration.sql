-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "HealthRecordKind" AS ENUM ('LAB_ANALYSIS', 'NOTE', 'OTHER');

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "avatarUrl" TEXT,
    "isManaged" BOOLEAN NOT NULL DEFAULT false,
    "familyRole" "FamilyRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "kind" "HealthRecordKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_telegramUserId_key" ON "Profile"("telegramUserId");

-- CreateIndex
CREATE INDEX "Profile_familyId_idx" ON "Profile"("familyId");

-- CreateIndex
CREATE INDEX "Profile_familyId_familyRole_idx" ON "Profile"("familyId", "familyRole");

-- CreateIndex
CREATE INDEX "HealthRecord_profileId_idx" ON "HealthRecord"("profileId");

-- CreateIndex
CREATE INDEX "HealthRecord_profileId_kind_idx" ON "HealthRecord"("profileId", "kind");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

