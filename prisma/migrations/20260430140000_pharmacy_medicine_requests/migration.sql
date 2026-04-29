-- CreateEnum
CREATE TYPE "MedicineRequestStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Pharmacy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Бишкек',
    "phones" TEXT[],
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "workHours" TEXT,
    "logoUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "telegramNotifyChatId" TEXT,
    "ownerProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pharmacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineRequest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "note" TEXT,
    "imageUrl" TEXT,
    "status" "MedicineRequestStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineRequestResponse" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "price" DOUBLE PRECISION,
    "priceUnit" TEXT DEFAULT 'сом',
    "note" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineRequestResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pharmacy_ownerProfileId_key" ON "Pharmacy"("ownerProfileId");

-- CreateIndex
CREATE INDEX "Pharmacy_isActive_idx" ON "Pharmacy"("isActive");

-- CreateIndex
CREATE INDEX "MedicineRequest_status_createdAt_idx" ON "MedicineRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MedicineRequest_profileId_idx" ON "MedicineRequest"("profileId");

-- CreateIndex
CREATE INDEX "MedicineRequestResponse_requestId_idx" ON "MedicineRequestResponse"("requestId");

-- CreateIndex
CREATE INDEX "MedicineRequestResponse_pharmacyId_idx" ON "MedicineRequestResponse"("pharmacyId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineRequestResponse_requestId_pharmacyId_key" ON "MedicineRequestResponse"("requestId", "pharmacyId");

-- AddForeignKey
ALTER TABLE "Pharmacy" ADD CONSTRAINT "Pharmacy_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineRequest" ADD CONSTRAINT "MedicineRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineRequestResponse" ADD CONSTRAINT "MedicineRequestResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MedicineRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineRequestResponse" ADD CONSTRAINT "MedicineRequestResponse_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
