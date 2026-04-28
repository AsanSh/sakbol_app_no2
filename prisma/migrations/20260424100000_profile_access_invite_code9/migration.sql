-- Unique 9-digit invite for ProfileAccess (QR / join_CODE / manual entry)
ALTER TABLE "ProfileAccess" ADD COLUMN "inviteCode9" TEXT;

CREATE UNIQUE INDEX "ProfileAccess_inviteCode9_key" ON "ProfileAccess"("inviteCode9");
