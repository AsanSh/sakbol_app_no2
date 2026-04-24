import { FamilyRole } from "@prisma/client";
import type { ProfileSummary } from "@/types/family";
import type { Lang } from "@/lib/i18n";

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

/** То же для интерфейса на кыргызском (без смешения с русским). */
export function profileKinshipLabelKg(profile: ProfileSummary): string {
  if (profile.familyRole === FamilyRole.ADMIN) {
    return "Админ";
  }

  if (!profile.isManaged) {
    return "Үй-бүлө мүчөсү";
  }

  const sex = profile.biologicalSex;
  switch (profile.managedRole) {
    case "CHILD":
      if (sex === "FEMALE") return "Кызы";
      if (sex === "MALE") return "Уулу";
      return "Баласы";
    case "SPOUSE":
      if (sex === "FEMALE") return "Аялы";
      if (sex === "MALE") return "Күйөөсү";
      return "Жубайы";
    case "ELDER":
      return "Ата-эне";
    case "OTHER":
    default:
      return "Тууганы";
  }
}

export function profileKinshipLabel(profile: ProfileSummary, lang: Lang): string {
  if (profile.isSharedGuest) {
    return lang === "kg" ? "Бөлүшүү" : "Совместный доступ";
  }
  return lang === "kg" ? profileKinshipLabelKg(profile) : profileKinshipLabelRu(profile);
}
