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
  /** Самоатрибуция в медкарточке (только свой профиль редактирует). */
  medCardIsDoctor?: boolean;
  medCardDoctorNote?: string | null;
  medCardIsCaregiver?: boolean;
  medCardCaregiverNote?: string | null;
  /**
   * Чужой профиль, к которому выдан гостевой доступ (`ProfileAccess`).
   * API добавляет в объекты из `sharedProfiles` и в слитый список `profiles` в `useFamilyDefault` — не опускайте при `fetch`/map.
   */
  isSharedGuest?: boolean;
  sharedAccessId?: string;
  sharedCanWrite?: boolean;
};

export type FamilyWithProfiles = {
  id: string;
  name: string | null;
  tier?: "FREE" | "PREMIUM";
  profiles: ProfileSummary[];
  sharedProfiles?: ProfileSummary[];
};

export type LabAnalysisRow = {
  id: string;
  title: string | null;
  data: unknown;
  isPrivate: boolean;
  createdAt: string;
};
