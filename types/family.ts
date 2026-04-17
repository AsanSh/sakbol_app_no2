import type { BiologicalSex, FamilyRole, ManagedRelationRole } from "@prisma/client";

export type ProfileSummary = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  familyRole: FamilyRole;
  isManaged: boolean;
  telegramUserId: string | null;
  managedRole: ManagedRelationRole | null;
  dateOfBirth: string | null;
  biologicalSex: BiologicalSex;
  heightCm: number | null;
  weightKg: number | null;
  bloodType: string | null;
};

export type FamilyWithProfiles = {
  id: string;
  name: string | null;
  tier?: "FREE" | "PREMIUM";
  profiles: ProfileSummary[];
};

export type LabAnalysisRow = {
  id: string;
  title: string | null;
  data: unknown;
  isPrivate: boolean;
  createdAt: string;
};
