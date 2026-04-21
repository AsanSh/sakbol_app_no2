/**
 * Импорт врачей из medik.kg и odoctor.kg в существующий JSON-каталог.
 *
 * Источники:
 *  - medik.kg    — полные данные (ФИО, телефон, адрес, специальность). Парсинг HTML.
 *  - odoctor.kg  — ФИО + фото + рейтинг (без телефонов). REST API.
 *  - ydoc.kg     — пропущен: имена врачей рендерятся на клиенте (JS).
 *
 * Дедупликация: нормализованное ФИО (строчные + ё→е).
 * Запуск: npx tsx scripts/sync-doctors-extra.ts
 *
 * Env-переменные:
 *  MAX_MEDIK_PAGES  — лимит страниц medik.kg (default: 600)
 *  SKIP_MEDIK       — "1" чтобы пропустить medik.kg
 *  SKIP_ODOCTOR     — "1" чтобы пропустить odoctor.kg
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DoctorEnriched } from "../lib/doctors-kg/types";

// ── конфигурация ──────────────────────────────────────────────────────────────

const DELAY_MS = 250; // задержка между запросами (вежливый краулер)
const UA = "SakBolDirectorySync/2.0 (+https://sakbol.vercel.app)";
const MAX_MEDIK_PAGES = Number(process.env.MAX_MEDIK_PAGES ?? 600);
const SKIP_MEDIK = process.env.SKIP_MEDIK === "1";
const SKIP_ODOCTOR = process.env.SKIP_ODOCTOR === "1";

// ── утилиты ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Нормализация ФИО для сравнения (убираем букву «ё», лишние пробелы, регистр). */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^а-яa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Транслитерация кириллицы в латиницу для slug. */
function transliterate(s: string): string {
  const MAP: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
    ж: "zh", з: "z", и: "i", й: "j", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return s
    .split("")
    .map((c) => MAP[c] ?? c)
    .join("");
}

function toSlug(name: string, suffix: string): string {
  return (
    transliterate(name.toLowerCase())
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") +
    "-" +
    suffix
  );
}

/** Нормализация телефонного номера: убираем пробелы, скобки и т.п. */
function normalizePhone(raw: string): string {
  // Оставляем цифры и ведущий +
  return raw.replace(/[^\d+]/g, "").replace(/^8/, "+7");
}

// ── medik.kg ──────────────────────────────────────────────────────────────────

interface MedikDoctor {
  name: string;
  slug: string;
  telephones: string[];
  streetAddress: string | null;
  clinicName: string | null;
  categorySlugs: string[];
  priceRange: string | null;
}

/**
 * Парсит одну страницу medik.kg.
 *
 * Структура HTML: каждый врач находится внутри <h2>-блока:
 *   <h2>
 *     <span><a href="/clinic/SLUG/">КЛИНИКА</a></span>
 *     <div class="doc_card_address_block">
 *       <span class="doc_{id}_card_address doc_card_address">АДРЕС</span>
 *       <a href="tel:НОМЕР">НОМЕР</a>
 *     </div>
 *     <h3><a href="/doctor/SLUG/">ФИО</a>
 *       <a href="/doctor/spec/SLUG/">Специальность</a>
 *       ...
 *     </h3>
 *     <h4>Квалификация</h4>
 *     <h6>Стоимость приема: ...</h6>
 *   </h2>
 */
function parseMedikPage(html: string): MedikDoctor[] {
  const results: MedikDoctor[] = [];

  // Разбиваем по открывающему тегу <h2
  const sections = html.split(/<h2(?:\s[^>]*)?>/);

  for (const section of sections) {
    // Фильтр: содержит ли секция доктора? (наличие ссылки /doctor/ не /doctor/spec/)
    // Имя может содержать <br> внутри <a> (например: "Эсекеев Эркинбек <br>Базарбаевич")
    const doctorMatch = section.match(/<h3[^>]*>\s*<a\s+href="\/doctor\/([^"\/]+)\/"[^>]*>([\s\S]*?)<\/a>/);
    if (!doctorMatch) continue;

    const doctorSlug = doctorMatch[1].trim();
    // Убираем теги (особенно <br>), нормализуем пробелы
    const doctorName = doctorMatch[2]
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Имя должно состоять из 2+ слов (ФИО)
    if (doctorName.split(/\s+/).length < 2) continue;
    // Не должно содержать явно нерусские слова-заглушки
    if (/^\d+$/.test(doctorName)) continue;

    // Клиника: из /clinic/ ссылки
    const clinicMatch = section.match(/href="\/clinic\/[^"]+"\s*[^>]*>([^<]+)<\/a>/);
    const clinicName = clinicMatch
      ? clinicMatch[1].replace(/…+$/g, "").trim()
      : null;

    // Адрес: из span с классом doc_card_address
    const addrMatch = section.match(/class="doc_\d+_card_address[^"]*"\s*>([^<]+)</);
    const streetAddress = addrMatch ? addrMatch[1].trim() : null;

    // Телефоны: все href="tel:..."
    const phones: string[] = [];
    const phoneRe = /href="tel:\s*([^"]+)"/g;
    let pm: RegExpExecArray | null;
    while ((pm = phoneRe.exec(section)) !== null) {
      const p = normalizePhone(pm[1]);
      if (p.length >= 7) phones.push(p);
    }

    // Специальности: из /doctor/spec/ ссылок
    const categorySlugs: string[] = [];
    const specRe = /href="\/doctor\/spec\/([^"\/]+)\//g;
    let sm: RegExpExecArray | null;
    while ((sm = specRe.exec(section)) !== null) {
      categorySlugs.push(sm[1]);
    }

    // Цена из h6
    const priceMatch = section.match(/Стоимость приема[:\s]*(?:<[^>]*>)*\s*([^<\n]{2,60})/);
    const priceRange = priceMatch
      ? priceMatch[1].replace(/<[^>]+>/g, "").trim() || null
      : null;

    results.push({
      name: doctorName,
      slug: doctorSlug,
      telephones: Array.from(new Set(phones)).filter(Boolean),
      streetAddress,
      clinicName,
      categorySlugs: Array.from(new Set(categorySlugs)),
      priceRange,
    });
  }

  return results;
}

async function fetchMedikPage(page: number): Promise<string | null> {
  const url = `https://medik.kg/doctor/?page=${page}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function scrapeMedik(
  existingNames: Set<string>,
): Promise<DoctorEnriched[]> {
  console.log("\n=== medik.kg ===");
  const collected: DoctorEnriched[] = [];
  let idCounter = 100_000;
  let page = 1;
  let emptyStreak = 0;

  while (page <= MAX_MEDIK_PAGES && emptyStreak < 3) {
    process.stdout.write(`\r  Страница ${page}/${MAX_MEDIK_PAGES}... +${collected.length} новых`);

    const html = await fetchMedikPage(page);
    if (!html) {
      emptyStreak++;
      page++;
      await sleep(DELAY_MS * 3);
      continue;
    }

    const doctors = parseMedikPage(html);
    if (doctors.length === 0) {
      emptyStreak++;
    } else {
      emptyStreak = 0;
    }

    for (const d of doctors) {
      const key = normalizeName(d.name);
      if (existingNames.has(key)) continue;
      existingNames.add(key);

      collected.push({
        id: idCounter++,
        slug: toSlug(d.name, "medik"),
        name: d.name,
        sourceUrl: `https://medik.kg/doctor/${d.slug}/`,
        categorySlugs: d.categorySlugs,
        cityFilterSlug: "loc-bishkek",
        cityCode: "bishkek",
        telephones: d.telephones,
        streetAddress: d.streetAddress,
        locality: d.clinicName ?? "Бишкек",
        region: "Чуй",
        country: "KG",
        website: null,
        image: null,
        priceRange: d.priceRange,
        latitude: null,
        longitude: null,
        description: null,
        openingHoursLines: [],
      });
    }

    page++;
    await sleep(DELAY_MS);
  }

  console.log(`\n  Готово: ${collected.length} новых врачей с medik.kg`);
  return collected;
}

// ── odoctor.kg ────────────────────────────────────────────────────────────────

interface OdoctorApiDoctor {
  id: number;
  name: string;
  slug: string;
  image_url: string;
  experience: number;
  feedback_count: number;
  feedback_score: number;
  is_active: boolean;
  academic_status: string | null;
  science_degree: string | null;
}

interface OdoctorApiResponse {
  count: number;
  next: string | null;
  results: OdoctorApiDoctor[];
}

async function fetchOdoctorPage(
  offset: number,
  limit = 100,
): Promise<OdoctorApiResponse | null> {
  const url = `https://api.odoctor.kg/api/v1/doctors/?city=10&limit=${limit}&offset=${offset}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as OdoctorApiResponse;
  } catch {
    return null;
  }
}

async function scrapeOdoctor(
  existingNames: Set<string>,
  idStart: number,
): Promise<DoctorEnriched[]> {
  console.log("\n=== odoctor.kg ===");
  const collected: DoctorEnriched[] = [];
  let idCounter = idStart;
  const LIMIT = 100;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    process.stdout.write(`\r  Offset ${offset}... +${collected.length} новых`);

    const resp = await fetchOdoctorPage(offset, LIMIT);
    if (!resp) {
      console.error(`\n  Ошибка на offset=${offset}, пропускаем`);
      break;
    }

    total = resp.count;

    for (const d of resp.results) {
      if (!d.is_active || !d.name?.trim()) continue;

      const key = normalizeName(d.name);
      if (existingNames.has(key)) continue;
      existingNames.add(key);

      // Описание из академического статуса / учёной степени
      const descParts = [d.academic_status, d.science_degree].filter(Boolean);
      const description = descParts.length > 0 ? descParts.join(", ") : null;

      collected.push({
        id: idCounter++,
        slug: `${d.slug}-odoctor`,
        name: d.name.trim(),
        sourceUrl: `https://odoctor.kg/doctors/${d.slug}`,
        categorySlugs: [], // API не возвращает специальность
        cityFilterSlug: "loc-bishkek",
        cityCode: "bishkek",
        telephones: [], // API не предоставляет телефоны
        streetAddress: null,
        locality: "Бишкек",
        region: "Чуй",
        country: "KG",
        website: null,
        image: d.image_url ?? null,
        priceRange: null,
        latitude: null,
        longitude: null,
        description,
        openingHoursLines: [],
      });
    }

    offset += LIMIT;
    await sleep(DELAY_MS);
  }

  console.log(`\n  Готово: ${collected.length} новых врачей с odoctor.kg`);
  return collected;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("SakBol Extra Doctor Sync");
  console.log(`  MAX_MEDIK_PAGES=${MAX_MEDIK_PAGES}`);
  console.log(`  SKIP_MEDIK=${SKIP_MEDIK}  SKIP_ODOCTOR=${SKIP_ODOCTOR}`);
  console.log();

  // Загружаем существующий JSON
  const outDir = path.join(process.cwd(), "public", "data");
  const outPath = path.join(outDir, "doctors-kg-enriched.json");
  let existingData: {
    generatedAt: string;
    source: string;
    doctors: DoctorEnriched[];
  };

  try {
    const raw = await readFile(outPath, "utf-8");
    existingData = JSON.parse(raw) as typeof existingData;
    console.log(`Существующий каталог: ${existingData.doctors.length} врачей`);
  } catch {
    console.log("Существующий каталог не найден, создаём новый");
    existingData = {
      generatedAt: new Date().toISOString(),
      source: "https://doctors.kg",
      doctors: [],
    };
  }

  // Строим множество уже известных имён
  const existingNames = new Set<string>(
    existingData.doctors.map((d) => normalizeName(d.name)),
  );

  const newDoctors: DoctorEnriched[] = [];
  let idCounter =
    Math.max(0, ...existingData.doctors.map((d) => d.id)) + 1;
  if (idCounter < 100_000) idCounter = 100_000;

  // medik.kg
  if (!SKIP_MEDIK) {
    const medikDocs = await scrapeMedik(existingNames);
    // Сдвигаем ID чтобы не перекрывались
    for (const d of medikDocs) {
      d.id = idCounter++;
    }
    newDoctors.push(...medikDocs);
  }

  // odoctor.kg
  if (!SKIP_ODOCTOR) {
    const odoctorDocs = await scrapeOdoctor(existingNames, idCounter);
    for (const d of odoctorDocs) {
      d.id = idCounter++;
    }
    newDoctors.push(...odoctorDocs);
  }

  // Сохраняем
  const allDoctors = [...existingData.doctors, ...newDoctors];

  const sources = ["https://doctors.kg"];
  if (!SKIP_MEDIK) sources.push("https://medik.kg");
  if (!SKIP_ODOCTOR) sources.push("https://odoctor.kg");

  await mkdir(outDir, { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: sources.join(" + "),
        doctors: allDoctors,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(
    `\n✓ Добавлено ${newDoctors.length} новых врачей. Итого: ${allDoctors.length}`,
  );
  console.log(`  Файл: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
