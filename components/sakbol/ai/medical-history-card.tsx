"use client";

import { useState, useTransition } from "react";
import { Sparkles, AlertTriangle, ActivitySquare, Stethoscope, HelpCircle } from "lucide-react";
import { analyzeMedicalHistoryForProfile, type MedicalHistoryAnalysis } from "@/app/actions/medical-history";
import { cn } from "@/lib/utils";

type AnalysisState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      result: MedicalHistoryAnalysis;
      meta: { analysesUsed: number; documentsUsed: number; medicationsUsed: number };
      disclaimer: string;
    }
  | { status: "error"; error: string };

const TREND_LABEL: Record<MedicalHistoryAnalysis["dynamics"][number]["trend"], string> = {
  rising: "рост",
  falling: "снижение",
  stable: "стабильно",
  insufficient_data: "мало данных",
};

const TREND_TONE: Record<MedicalHistoryAnalysis["dynamics"][number]["trend"], string> = {
  rising: "bg-amber-50 text-amber-800 border-amber-200",
  falling: "bg-sky-50 text-sky-800 border-sky-200",
  stable: "bg-emerald-50 text-emerald-800 border-emerald-200",
  insufficient_data: "bg-slate-50 text-slate-600 border-slate-200",
};

const SEVERITY_TONE: Record<MedicalHistoryAnalysis["riskFlags"][number]["severity"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  watch: "border-amber-200 bg-amber-50 text-amber-900",
  important: "border-rose-200 bg-rose-50 text-rose-900",
};

export function MedicalHistoryAnalysisCard({
  profileId,
}: {
  profileId: string | null | undefined;
}) {
  const [state, setState] = useState<AnalysisState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  const run = () => {
    if (!profileId) return;
    setState({ status: "loading" });
    startTransition(async () => {
      const res = await analyzeMedicalHistoryForProfile(profileId);
      if (res.ok) {
        setState({
          status: "ready",
          result: res.result,
          meta: res.meta,
          disclaimer: res.disclaimer,
        });
      } else {
        setState({ status: "error", error: res.error });
      }
    });
  };

  return (
    <div className="rounded-2xl border border-[#e7e8e9] bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#004253] to-[#005b71] text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#191c1d]">Связи и риски</h3>
          <p className="mt-0.5 text-xs text-[#70787d]">
            Глубокий разбор последних анализов, документов и лекарств с подсказками, к каким врачам имеет смысл обратиться.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={!profileId || pending || state.status === "loading"}
        className={cn(
          "mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#004253] to-[#005b71] px-3 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50",
        )}
      >
        {state.status === "loading" || pending ? (
          <>
            <span className="animate-bounce">●</span>
            <span className="animate-bounce [animation-delay:0.15s]">●</span>
            <span className="animate-bounce [animation-delay:0.3s]">●</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {state.status === "ready" ? "Пересобрать разбор" : "Сделать разбор"}
          </>
        )}
      </button>

      {state.status === "error" ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
          {state.error}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <ResultBlock data={state.result} meta={state.meta} disclaimer={state.disclaimer} />
      ) : null}
    </div>
  );
}

function ResultBlock({
  data,
  meta,
  disclaimer,
}: {
  data: MedicalHistoryAnalysis;
  meta: { analysesUsed: number; documentsUsed: number; medicationsUsed: number };
  disclaimer: string;
}) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="rounded-xl border border-[#e7e8e9] bg-[#f8f9fa] p-2 text-xs text-[#70787d]">
        Использовано: анализов — {meta.analysesUsed}, документов — {meta.documentsUsed}, лекарств — {meta.medicationsUsed}.
      </div>

      {data.summary ? (
        <section className="rounded-xl border border-[#e7e8e9] p-3">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#70787d]">Кратко</h4>
          <p className="whitespace-pre-wrap text-[13px] text-[#191c1d]">{data.summary}</p>
        </section>
      ) : null}

      {data.dynamics.length > 0 ? (
        <section className="rounded-xl border border-[#e7e8e9] p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#70787d]">
            <ActivitySquare className="h-3.5 w-3.5" /> Динамика
          </h4>
          <ul className="space-y-2">
            {data.dynamics.map((d, i) => (
              <li key={i} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[#191c1d]">{d.biomarker}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      TREND_TONE[d.trend],
                    )}
                  >
                    {TREND_LABEL[d.trend]}
                  </span>
                </div>
                {d.comment ? <p className="text-xs text-[#70787d]">{d.comment}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.riskFlags.length > 0 ? (
        <section className="rounded-xl border border-[#e7e8e9] p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#70787d]">
            <AlertTriangle className="h-3.5 w-3.5" /> На что обратить внимание
          </h4>
          <ul className="space-y-2">
            {data.riskFlags.map((r, i) => (
              <li key={i} className={cn("rounded-xl border p-2 text-xs", SEVERITY_TONE[r.severity])}>
                <p className="text-[13px] font-semibold">{r.title}</p>
                {r.explanation ? <p className="mt-1 leading-snug">{r.explanation}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.doctorRecommendations.length > 0 ? (
        <section className="rounded-xl border border-[#e7e8e9] p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#70787d]">
            <Stethoscope className="h-3.5 w-3.5" /> К какому врачу
          </h4>
          <ul className="space-y-1.5">
            {data.doctorRecommendations.map((r, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium capitalize text-[#191c1d]">{r.specialty}</span>
                {r.reason ? <span className="text-xs text-[#70787d]">{r.reason}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.questionsForDoctor.length > 0 ? (
        <section className="rounded-xl border border-[#e7e8e9] p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#70787d]">
            <HelpCircle className="h-3.5 w-3.5" /> Вопросы врачу
          </h4>
          <ul className="list-disc space-y-1 pl-4 text-[13px] text-[#191c1d]">
            {data.questionsForDoctor.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs leading-snug text-amber-900">
        {disclaimer}
      </p>
    </div>
  );
}
