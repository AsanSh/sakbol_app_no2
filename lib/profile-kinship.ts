import { FamilyRole } from "@prisma/client";
import type { ProfileSummary } from "@/types/family";

/** Короткая подпись роли в семье для списков (RU). */
export function profileKinshipLabelRu(profile: ProfileSummary): string {
  if (profile.familyRole === FamilyRole.ADMIN) {
    return "Админ";
  }

  if (!profile.isManaged) {
    return "Член семьи";
  }

  const sex = profile.biologicalSex;
  switch (profile.managedRole) {
    case "CHILD":
      if (sex === "FEMALE") return "Дочь";
      if (sex === "MALE") return "Сын";
      return "Ребёнок";
    case "SPOUSE":
      if (sex === "FEMALE") return "Супруга";
      if (sex === "MALE") return "Супруг";
      return "Супруг(а)";
    case "ELDER":
      return "Родитель";
    case "OTHER":
    default:
      return "Родственник";
  }
}
