-- CreateTable: ProfileAccess — shared profile access between different family accounts
CREATE TABLE "ProfileAccess" (
    "id"               TEXT NOT NULL,
    "sourceProfileId"  TEXT NOT NULL,
    "granteeProfileId" TEXT,
    "canWrite"         BOOLEAN NOT NULL DEFAULT true,
    "inviteToken"      TEXT NOT NULL,
    "inviteExpiresAt"  TIMESTAMP(3),
    "acceptedAt"       TIMESTAMP(3),
    "revokedAt"        TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileAccess_inviteToken_key" ON "ProfileAccess"("inviteToken");
CREATE INDEX "ProfileAccess_sourceProfileId_idx" ON "ProfileAccess"("sourceProfileId");
CREATE INDEX "ProfileAccess_granteeProfileId_idx" ON "ProfileAccess"("granteeProfileId");
CREATE INDEX "ProfileAccess_inviteToken_idx" ON "ProfileAccess"("inviteToken");

-- AddForeignKey
ALTER TABLE "ProfileAccess" ADD CONSTRAINT "ProfileAccess_sourceProfileId_fkey"
    FOREIGN KEY ("sourceProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileAccess" ADD CONSTRAINT "ProfileAccess_granteeProfileId_fkey"
    FOREIGN KEY ("granteeProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
