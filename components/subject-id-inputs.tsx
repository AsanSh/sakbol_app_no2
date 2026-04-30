"use client";

import { SubjectIdCountry } from "@prisma/client";
import {
  maxDigitsForCountry,
  subjectIdDocLabel,
  SUBJECT_ID_COUNTRY_OPTIONS,
} from "@/lib/subject-id-country";
import { cn } from "@/lib/utils";

export function SubjectIdCountrySelect({
  value,
  onChange,
  disabled,
  className,
  id,
}: {
  value: SubjectIdCountry;
  onChange: (v: SubjectIdCountry) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      className={cn(
        "w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2 text-sm text-emerald-950 outline-none ring-emerald-600 focus-visible:ring-2",
        className,
      )}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as SubjectIdCountry)}
    >
      {SUBJECT_ID_COUNTRY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label} — {o.docHint}
        </option>
      ))}
    </select>
  );
}

export function SubjectIdNumberInput({
  country,
  value,
  onChange,
  disabled,
  className,
  id,
}: {
  country: SubjectIdCountry;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const max = maxDigitsForCountry(country);
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      className={cn(
        "w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-base tracking-widest text-emerald-950 outline-none ring-emerald-600 focus-visible:ring-2",
        className,
      )}
      placeholder={subjectIdDocLabel(country)}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, max))}
    />
  );
}

export { subjectIdDocLabel, maxDigitsForCountry };
