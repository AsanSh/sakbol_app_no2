/** Лаборатории и клиники КР (Бишкек / юг) — для подсказок при warning/critical. */
export type Clinic = {
  name: string;
  address: string;
  phone: string;
  bookingUrl: string;
};

export const BISHKEK_CLINICS: Clinic[] = [
  {
    name: "Бонецкий",
    address: "г. Бишкек, пр. Манаса / Медакадемия",
    phone: "+996 312 90 00 90",
    bookingUrl: "https://bonetsky.kg",
  },
  {
    name: "AquaLab",
    address: "г. Бишкек, ул. Токтогула",
    phone: "+996 312 66 11 22",
    bookingUrl: "https://aqualab.kg",
  },
  {
    name: "Неомед",
    address: "г. Бишкек, 7 мкр.",
    phone: "+996 312 55 66 77",
    bookingUrl: "https://neomed.kg",
  },
  {
    name: "Эос",
    address: "г. Бишкек, ул. Чүй",
    phone: "+996 312 98 77 44",
    bookingUrl: "https://eoslab.kg",
  },
  {
    name: "Юрфа",
    address: "г. Ош / г. Бишкек (филиалы уточняйте)",
    phone: "+996 322 00 00 00",
    bookingUrl: "https://yurfa.kg",
  },
];
