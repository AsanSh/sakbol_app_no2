/**
 * Группировка показателей для «медицинской карты» (UI).
 */
export type BiomarkerCategoryId =
  | "hema"
  | "metabolic"
  | "lipids"
  | "liver_kidney"
  | "thyroid_vitamins"
  | "other";

const KEY_TO_CAT: Record<string, BiomarkerCategoryId> = {
  Гемоглобин: "hema",
  Лейкоциттер: "hema",
  Тромбоциттер: "hema",
  Глюкоза: "metabolic",
  Холестерин: "lipids",
  ЛПНП: "lipids",
  ЛПВП: "lipids",
  Креатинин: "liver_kidney",
  ТТГ: "thyroid_vitamins",
  Т3: "thyroid_vitamins",
  Т4: "thyroid_vitamins",
  "Витамин D": "thyroid_vitamins",
  Ферритин: "hema",
  "С-реактивный белок": "hema",
};

export function categoryForBiomarkerKey(canonicalKey: string): BiomarkerCategoryId {
  return KEY_TO_CAT[canonicalKey] ?? "other";
}
