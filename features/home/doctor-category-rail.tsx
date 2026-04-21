"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Baby,
  Bone,
  Brain,
  Eye,
  HeartPulse,
  Microscope,
  Pill,
  Stethoscope,
  Syringe,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MetaCategory = { slug: string; label: string };

const ICONS = [Stethoscope, HeartPulse, Brain, Eye, Bone, Baby, Syringe, Microscope, Pill, UserRound];

export function DoctorCategoryRail() {
  const router = useRouter();
  const [categories, setCategories] = useState<MetaCategory[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/doctors-kg/meta")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || j.error) return;
        setCategories((j.categories as MetaCategory[])?.slice(0, 12) ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!categories.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-manrope text-lg font-semibold text-slate-900">Категории врачей</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((c, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => router.push(`/?tab=home&doctorCat=${encodeURIComponent(c.slug)}`, { scroll: false })}
              className={cn(
                "flex min-w-[5.5rem] shrink-0 flex-col items-center gap-2 rounded-2xl bg-white px-3 py-4 shadow-sm ring-1 ring-slate-200/80 transition hover:ring-teal-200 hover:shadow-md",
              )}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8FAFC] text-[#2A5298]">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="max-w-[5.5rem] text-center text-[11px] font-semibold leading-tight text-slate-800">
                {c.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
