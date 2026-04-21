import { decodeHtmlEntities } from "@/lib/html-entities";
import { normalizeTelHref } from "@/lib/doctors-kg/tel";

/** Один номер или номер с подписью (регистратура, мобильный и т.д.). */
export type PhoneEntry = string | { number: string; label?: string };

/** Модель для универсального вызова (`phones` и legacy `telephones`). */
export type DoctorForCall = {
  name?: string;
  phones?: PhoneEntry[];
  telephones?: PhoneEntry[];
};

function entryRaw(entry: PhoneEntry): string {
  return typeof entry === "string" ? entry : entry.number;
}

function entryLabel(entry: PhoneEntry): string | undefined {
  return typeof entry === "string" ? undefined : entry.label?.trim() || undefined;
}

export type PhoneSelectEntry = { raw: string; label?: string };

const listFromDoctor = (doctor: DoctorForCall): PhoneEntry[] =>
  doctor.phones ?? doctor.telephones ?? [];

/** Уникальные номера с опциональными подписями (первая встреченная подпись сохраняется). */
export function getPhoneEntries(doctor: DoctorForCall): PhoneSelectEntry[] {
  const items = listFromDoctor(doctor);
  if (!items.length) return [];
  const out: PhoneSelectEntry[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const raw = decodeHtmlEntities(entryRaw(item)).trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    out.push({ raw, label: entryLabel(item) });
  }
  return out;
}

export function getPhonesList(doctor: DoctorForCall): string[] {
  return getPhoneEntries(doctor).map((e) => e.raw);
}

/**
 * Визуальное форматирование (пример: +996 700 123 456).
 */
export function formatPhoneDisplay(raw: string): string {
  const t = decodeHtmlEntities(raw).trim();
  const h = normalizeTelHref(t);
  if (!h) return t;
  const digits = h.replace(/\D/g, "");
  if (digits.startsWith("996") && digits.length >= 12) {
    const r = digits.slice(3, 12);
    return `+996 ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6)}`;
  }
  if (digits.length >= 9) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`.trim();
  }
  return h;
}

type TelegramWebApp = { openLink?: (url: string) => void };

/**
 * Универсальный набор: Telegram Mini App → window.open → location → программный &lt;a tel:&gt;.
 */
export function triggerPhoneCall(raw: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const h = normalizeTelHref(decodeHtmlEntities(raw).trim());
  if (!h) return;
  const uri = `tel:${h}`;

  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
      ?.WebApp;
    tg?.openLink?.(uri);
  } catch {
    /* noop */
  }

  try {
    window.open(uri, "_self", "noopener,noreferrer");
  } catch {
    /* noop */
  }

  try {
    window.location.href = uri;
  } catch {
    /* noop */
  }

  const a = document.createElement("a");
  a.href = uri;
  a.setAttribute("rel", "noreferrer");
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type HandleDoctorCallUi = {
  onMultiplePhones: (entries: PhoneSelectEntry[]) => void;
  onUnavailable: () => void;
};

/**
 * CASE A: один номер → сразу набор.
 * CASE B: несколько → колбэк на модалку (с подписями, если есть).
 * CASE C: пусто → onUnavailable.
 */
export function handleDoctorCall(doctor: DoctorForCall, ui: HandleDoctorCallUi): void {
  const entries = getPhoneEntries(doctor);
  if (entries.length === 0) {
    ui.onUnavailable();
    return;
  }
  if (entries.length === 1) {
    triggerPhoneCall(entries[0].raw);
    return;
  }
  ui.onMultiplePhones(entries);
}
