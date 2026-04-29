import type { FamilyWithProfiles } from "@/types/family";

/** Вкладка «Пациенты»: врач, сиделка или владелец аптеки (клиника) в этом аккаунте. */
export function showPatientsTabForFamily(family: FamilyWithProfiles | null, loading: boolean): boolean {
  if (loading || !family?.viewerProfileId) return false;
  const viewer = family.profiles.find((p) => p.id === family.viewerProfileId);
  return Boolean(
    viewer?.medCardIsDoctor || viewer?.medCardIsCaregiver || family.viewerOwnsPharmacy,
  );
}
