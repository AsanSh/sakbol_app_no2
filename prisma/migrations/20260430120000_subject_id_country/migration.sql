-- CreateEnum
CREATE TYPE "SubjectIdCountry" AS ENUM ('KG', 'KZ', 'UZ', 'RU');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "subjectIdCountry" "SubjectIdCountry";
