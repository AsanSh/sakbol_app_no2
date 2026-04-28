-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "medCardIsDoctor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN     "medCardDoctorNote" TEXT;
ALTER TABLE "Profile" ADD COLUMN     "medCardIsCaregiver" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN     "medCardCaregiverNote" TEXT;
