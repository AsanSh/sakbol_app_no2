"use client";

import { useLayoutEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useLanguage } from "@/context/language-context";
import { t } from "@/lib/i18n";

type Props = {
  className?: string;
};

export function MedFormulaBlock({ className }: Props) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const findriscRef = useRef<HTMLDivElement>(null);
  const ascvdRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const opts = { displayMode: true, throwOnError: false };
    if (findriscRef.current) {
      katex.render(
        String.raw`\text{FINDRISC} = \sum_i \text{баллы}_i \quad (\text{возраст, ИМТ, талия, активность, овощи, АГ, глюкоза, родственники})`,
        findriscRef.current,
        opts,
      );
    }
    if (ascvdRef.current) {
      katex.render(
        String.raw`\text{ASCVD}_{10y} = \Bigl(1 - S_0^{\exp(\mathrm{LP} - \overline{\mathrm{LP}})}\Bigr)\cdot 100\%`,
        ascvdRef.current,
        opts,
      );
    }
    if (scoreRef.current) {
      katex.render(
        String.raw`\text{SCORE}_{\text{demo}} \approx f(\text{возраст}) + c_{\text{курение}} + c_{\text{хол}} + c_{\text{САД}}`,
        scoreRef.current,
        opts,
      );
    }
  }, [open, lang]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-emerald-800 underline underline-offset-2"
      >
        {t(lang, "hub.formulasToggle")}
      </button>
      {open ? (
        <div className="mt-3 space-y-4 rounded-xl border border-emerald-900/15 bg-emerald-900/5 p-3 text-emerald-950">
          <p className="text-[11px] font-semibold">{t(lang, "hub.formulasTitle")}</p>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-emerald-800/80">FINDRISC</p>
            <div ref={findriscRef} className="overflow-x-auto" />
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-emerald-800/80">ASCVD (PCE)</p>
            <div ref={ascvdRef} className="overflow-x-auto" />
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-emerald-800/80">SCORE (демо)</p>
            <div ref={scoreRef} className="overflow-x-auto" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
