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
    title: "Уход на дому и сопровождение",
    city: "Бишкек",
    phones: ["996507807768"],
    tags: ["home", "bedridden", "procedures"],
    summary:
      "Услуги сиделки и помощника по уходу на дому. Индивидуальный уход за пожилыми людьми и людьми с ограниченной подвижностью. Контроль приёма лекарств по расписанию. Помощь в гигиенических процедурах: мытьё, душ, переодевание, контроль чистоты. Сопровождение по дому и на прогулках, профилактика падений. Помощь по дому: лёгкая уборка, приготовление простой еды, покупка продуктов по списку. Измерение АД, пульса, температуры и наблюдение за самочувствием. Организация режима дня, напоминания о визитах к врачу. Эмоциональная поддержка, общение, чтение, совместные занятия для поддержания когнитивной активности. Опыт работы с лежачими больными и в послеоперационном периоде. Аккуратность, такт, умение работать в домашней среде. Медицинская форма, соблюдение санитарных норм и конфиденциальности. «Подберу программу ухода с учётом потребностей человека и рекомендаций врача».",
  },
  {
    id: "cg-2",
    title: "Сиделка (педагог)",
    subtitle: "54 года",
    city: "Бишкек",
    phones: ["996700569112"],
    tags: ["home"],
    summary:
      "Оказываю услуги сиделки / помощника по уходу за пожилыми на дому. Добрая, заботливая, аккуратный человек, хорошо готовлю. 54 года, по образованию педагог, нахожу общий язык со всеми.",
    note:
      "В объявлении указано: просят не беспокоить мужчин с недобросовестными намерениями; при необходимости контакт через сына (работает в РОВД).",
  },
  {
    id: "cg-3",
    title: "С медицинским образованием",
    city: "Бишкек",
    phones: ["996502992324"],
    whatsappPreferred: true,
    tags: ["medical_education", "home"],
    summary:
      "Сиделка, ищу работу. Большой опыт работы, есть медицинское образование. Связь удобнее в WhatsApp (звонок или сообщение).",
  },
  {
    id: "cg-4",
    title: "Профессиональный уход (стационар и дом)",
    city: "Бишкек",
    phones: ["996706555177"],
    tags: ["hospital", "home", "procedures"],
    summary:
      "Услуги сиделки (Бишкек). Профессиональный уход и сопровождение: уход за пожилыми, уход за больными, сиделка в стационаре, выездная сиделка, сиделка на дому. Дополнительно: кормление, прогулки, капельницы, гигиенические процедуры, массаж. «Уход — наша работа. Рады помочь».",
  },
  {
    id: "cg-5",
    title: "Катя",
    subtitle: "15 лет опыта · Бишкек",
    city: "Бишкек",
    phones: ["996550260264"],
    experienceYears: 15,
    tags: ["home", "experience_15"],
    summary: "Сиделка, ищу работу, 15 лет опыта. Катя, Бишкек.",
  },
  {
    id: "cg-6",
    title: "Наталья",
    city: "Бишкек",
    phones: ["996558051968"],
    tags: ["home"],
    summary:
      "Сиделка: уход за пожилыми и больными, большой опыт работы. Внимательная и пунктуальная, ищу работу. Наталья — звоните, договоримся.",
  },
  {
    id: "cg-7",
    title: "Кенже",
    subtitle: "56 лет · 20 лет опыта",
    city: "Бишкек",
    phones: ["996703271069"],
    experienceYears: 20,
    tags: ["hospital", "home", "bedridden", "experience_15", "procedures"],
    summary:
      "Сиделка, Бишкек. Профессиональный уход за пожилыми и лежачими больными. 20 лет опыта сиделки. Контроль приёма лекарств; измерение АД, температуры, сатурации; гигиенический уход; лечение и профилактика пролежней. Работа на дому и в стационаре.",
  },
  {
    id: "cg-8",
    title: "Эля",
    subtitle: "48 лет",
    city: "Бишкек",
    phones: ["996997618555"],
    tags: ["hospital", "home", "bedridden", "procedures"],
    summary:
      "Услуга: сиделка (Бишкек). Навыки: уход за лежачими больными; помощь в гигиене (купание, подгузники); контроль лекарств; измерение АД и температуры; приготовление еды и кормление; заботливое и внимательное отношение. Возможен уход за пациентом в стационаре. Эля, 48 лет.",
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
