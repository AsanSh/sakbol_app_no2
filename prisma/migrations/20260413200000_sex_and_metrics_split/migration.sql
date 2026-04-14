-- CreateEnum
CREATE TYPE "BiologicalSex" AS ENUM ('UNKNOWN', 'MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "biologicalSex" "BiologicalSex" NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "HealthRecordMetrics" (
    "id" TEXT NOT NULL,
    "healthRecordId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "HealthRecordMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthRecordMetrics_healthRecordId_key" ON "HealthRecordMetrics"("healthRecordId");

-- AddForeignKey
ALTER TABLE "HealthRecordMetrics" ADD CONSTRAINT "HealthRecordMetrics_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "HealthRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
