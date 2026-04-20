/** Типы для интеграции с каталогом doctors.kg (WordPress REST + JSON-LD). */

export type WpDoctorApi = {
  id: number;
  slug: string;
  title: { rendered: string };
  link: string;
  class_list?: string[];
};

export type DoctorSummary = {
  id: number;
  slug: string;
  name: string;
  sourceUrl: string;
  categorySlugs: string[];
  /** REST-фильтр: loc-bishkek */
  cityFilterSlug: string | null;
  /** Короткий код города из class_list: bishkek */
  cityCode: string | null;
};

export type LocalBusinessLd = {
  "@type"?: string;
  name?: string;
  telephone?: string | string[];
  description?: string;
  url?: string;
  sameAs?: string;
  image?: string;
  priceRange?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    addressCountry?: string;
  };
  geo?: { latitude?: number; longitude?: number };
};

export type DoctorEnriched = DoctorSummary & {
  telephones: string[];
  streetAddress: string | null;
  locality: string | null;
  region: string | null;
  country: string | null;
  website: string | null;
  image: string | null;
  priceRange: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ClinicDerived = {
  id: string;
  name: string;
  address: string;
  city: string;
  phones: string[];
  doctorCount: number;
  sampleDoctorSlug: string;
};
