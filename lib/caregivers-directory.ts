import { normalizeTelHref } from "@/lib/doctors-kg/tel";

/** Теги для фильтров на экране «Сиделки». */
export type CaregiverTagId =
  | "hospital"
  | "home"
  | "medical_education"
  | "bedridden"
  | "procedures"
  | "experience_15";

export type CaregiverListing = {
  id: string;
  title: string;
  subtitle?: string;
  city: string;
  phones: string[];
  whatsappPreferred?: boolean;
  experienceYears?: number;
  tags: CaregiverTagId[];
  summary: string;
  /** Доп. предупреждение (напр. об ограничениях по звонкам). */
  note?: string;
};

export const CAREGIVER_TAG_IDS: CaregiverTagId[] = [
  "hospital",
  "home",
  "medical_education",
  "bedridden",
  "procedures",
  "experience_15",
];

/**
 * Контакты из открытых объявлений (ориентир — Бишкек).
 * SakBol не проверяет исполнителей; договорённости — напрямую с контактом.
 */
export const CAREGIVER_LISTINGS: CaregiverListing[] = [
  {
    id: "cg-1",
    title: "Индивидуальный уход",
    city: "Бишкек",
    phones: ["996507807768"],
    tags: ["home", "bedridden"],
    summary:
      "Уход на дому: лекарства по расписанию, гигиена (мытьё, одевание), сопровождение и прогулки, быт (уборка, готовка, покупки), контроль АД, пульса и температуры, поддержка и занятия. Опыт с лежачими и послеоперационными, медформа, санитарные нормы.",
  },
  {
    id: "cg-2",
    title: "Сиделка (педагог)",
    subtitle: "54 года",
    city: "Бишкек",
    phones: ["996700569112"],
    tags: ["home"],
    summary:
      "Добрая, аккуратная, хорошо готовит. Уход за пожилыми на дому.",
    note:
      "В объявлении указано: не принимать звонки от мужчин с недобросовестными намерениями.",
  },
  {
    id: "cg-3",
    title: "С мед. образованием",
    city: "Бишкек",
    phones: ["996502992324"],
    whatsappPreferred: true,
    tags: ["medical_education", "home"],
    summary: "Большой стаж, медицинское образование. Удобнее связь в WhatsApp.",
  },
  {
    id: "cg-4",
    title: "Стационар и на дому",
    city: "Бишкек",
    phones: ["996706555177"],
    tags: ["hospital", "home", "procedures"],
    summary:
      "Уход в стационаре и дома, выездной уход, больные и пожилые. Кормление, прогулки, капельницы, гигиенические процедуры, массаж.",
  },
  {
    id: "cg-5",
    title: "Катя",
    subtitle: "15 лет опыта · сиделка, иш издейм",
    city: "Бишкек",
    phones: ["996550260264"],
    experienceYears: 15,
    tags: ["home", "experience_15"],
    summary:
      "Сиделка в Бишкеке, иш издейм. Многолетний опыт ухода и сопровождения.",
  },
  {
    id: "cg-6",
    title: "Наталья",
    city: "Бишкек",
    phones: ["996558051968"],
    tags: ["home"],
    summary: "Внимательная и пунктуальная. Уход за пожилыми и больными.",
  },
  {
    id: "cg-7",
    title: "Кенже",
    subtitle: "56 лет · 20 лет опыта",
    city: "Бишкек",
    phones: ["996703271069"],
    experienceYears: 20,
    tags: ["hospital", "home", "bedridden", "experience_15"],
    summary:
      "Дом и стационар. Контроль приёма лекарств, АД, температуры, сатурации; гигиена; профилактика и уход при пролежнях.",
  },
  {
    id: "cg-8",
    title: "Эля",
    subtitle: "48 лет",
    city: "Бишкек",
    phones: ["996997618555"],
    tags: ["hospital", "home", "bedridden"],
    summary:
      "Дом и стационар. Лежачие больные, купание и подгузники, лекарства, витальные показатели, приготовление еды и кормление.",
  },
];

export function caregiverWhatsappHref(phone: string): string | null {
  const digits = normalizeTelHref(phone).replace(/\D/g, "");
  if (digits.length < 12) return null;
  return `https://wa.me/${digits}`;
}

export function filterCaregiverListings(
  listings: CaregiverListing[],
  opts: { search: string; tagFilters: Set<CaregiverTagId> },
): CaregiverListing[] {
  const q = opts.search.trim().toLowerCase();
  return listings.filter((L) => {
    if (opts.tagFilters.size > 0) {
      const any = [...opts.tagFilters].some((t) => L.tags.includes(t));
      if (!any) return false;
    }
    if (!q) return true;
    const phonesHay = L.phones.join(" ");
    const hay =
      `${L.title} ${L.subtitle ?? ""} ${L.summary} ${L.city} ${L.note ?? ""} ${phonesHay}`.toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    if (qDigits.length >= 6 && phonesHay.replace(/\D/g, "").includes(qDigits)) return true;
    return hay.includes(q);
  });
}
