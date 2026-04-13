-- CreateEnum
CREATE TYPE "ManagedRelationRole" AS ENUM ('CHILD', 'ELDER', 'OTHER');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "managedRole" "ManagedRelationRole",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3);
