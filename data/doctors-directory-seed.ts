/**
 * Статические демо-данные для UI «врачи / клиники».
 * Вдохновлены открытыми специальностями каталогов вроде doctors.kg; не для мед. утверждений.
 */

export type SeedDoctor = {
  id: string;
  fullName: string;
  specialty: string;
  clinic: string;
  city: string;
  /** Плейсхолдер под фото */
  photoHint: string;
};

export type SeedClinic = {
  id: string;
  name: string;
  address: string;
  city: string;
  specialties: string[];
};

export const SEED_SPECIALTY_CHIPS = [
  "Терапевт",
  "Кардиолог",
  "Эндокринолог",
  "Гинеколог",
  "Педиатр",
  "Невролог",
  "Уролог",
  "ЛОР",
  "Гастроэнтеролог",
  "Дерматолог",
] as const;

export const SEED_DOCTORS: SeedDoctor[] = [
  {
    id: "d1",
    fullName: "Тронина Дарья Дмитриевна",
    specialty: "Кардиолог",
    clinic: "КардиоЦентр Бишкек",
    city: "Бишкек",
    photoHint: "TT",
  },
  {
    id: "d2",
    fullName: "Петросьянц Алексей Владимирович",
    specialty: "Андролог",
    clinic: "UroMed Clinic",
    city: "Бишкек",
    photoHint: "ПА",
  },
  {
    id: "d3",
    fullName: "Умарова Жамиля Жалгашевна",
    specialty: "Невролог",
    clinic: "Невро+",
    city: "Бишкек",
    photoHint: "УЖ",
  },
  {
    id: "d4",
    fullName: "Сапарова Нурсүлүү Мустафаевна",
    specialty: "Гастроэнтеролог",
    clinic: "GastroLife",
    city: "Бишкек",
    photoHint: "СН",
  },
  {
    id: "d5",
    fullName: "Халилов Нурадин Мустафаевич",
    specialty: "ЛОР",
    clinic: "ENT Studio",
    city: "Бишкек",
    photoHint: "ХН",
  },
];

export const SEED_CLINICS: SeedClinic[] = [
  {
    id: "c1",
    name: "КардиоЦентр Бишкек",
    address: "ул. Манаса,  д. 00 (демо-адрес)",
    city: "Бишкек",
    specialties: ["Кардиология", "УЗИ сердца"],
  },
  {
    id: "c2",
    name: "Семейная поликлиника «Айыл»",
    address: "пр. Чуй, д. 00 (демо)",
    city: "Бишкек",
    specialties: ["Терапия", "Педиатрия", "Лаборатория"],
  },
  {
    id: "c3",
    name: "GastroLife",
    address: "мкр. Джал, д. 00 (демо)",
    city: "Бишкек",
    specialties: ["Гастроэнтерология", "Эндоскопия"],
  },
];
