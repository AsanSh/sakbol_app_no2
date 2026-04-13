export type Clinic = {
  name: string;
  area: string;
  phone: string;
  bookingUrl: string;
};

export const BISHKEK_CLINICS: Clinic[] = [
  { name: "Bonetsky", area: "Медакадемия", phone: "+996 312 90 00 90", bookingUrl: "https://bonetsky.kg" },
  { name: "AquaLab", area: "Токтогула", phone: "+996 312 66 11 22", bookingUrl: "https://aqualab.kg" },
  { name: "ЭОС", area: "Чүй", phone: "+996 312 98 77 44", bookingUrl: "https://eoslab.kg" },
  { name: "NeoMed", area: "7 мкр", phone: "+996 312 55 66 77", bookingUrl: "https://neomed.kg" },
  { name: "Invitro Бишкек", area: "Юг-2", phone: "+996 312 45 33 22", bookingUrl: "https://invitro.kg" },
];
