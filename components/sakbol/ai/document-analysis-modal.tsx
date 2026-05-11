"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  HelpCircle,
  Pill,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import {
  analyzeHealthDocumentAi,
  type AnalyzeHealthDocumentActionResult,
} from "@/app/actions/health-document";
import { cn } from "@/lib/utils";

type Analysis = Extract<AnalyzeHealthDocumentActionResult, { ok: true }>;

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: Analysis }
  | { status: "error"; error: string };

export function DocumentAiAnalysisModal({
  open,
  onClose,
  documentId,
  documentTitle,
}: {
  open: boolean;
  onClose: () => void;
  documentId: string | null;
  documentTitle?: string;
}) {
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    if (!open || !documentId) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      try {
        const res = await analyzeHealthDocumentAi(documentId);
        if (cancelled) return;
        if (res.ok) {
          setState({ status: "ready", data: res });
        } else {
          setState({ status: "error", error: res.error });
        }
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          error: e instanceof Error ? e.message : "Не удалось получить разбор.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  if (!open) return null;

  if (typeof window === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
              aria-label="Назад"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </button>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#004253] to-[#005b71] text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#191c1d]">
                Разбор документа
              </p>
              {documentTitle ? (
                <p className="truncate text-xs text-[#70787d]">{documentTitle}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm text-[#191c1d]">
          {state.status === "loading" ? (
            <LoadingBlock />
          ) : state.status === "error" ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {state.error}
            </p>
          ) : state.status === "ready" ? (
            <AnalysisBody data={state.data} />
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function LoadingBlock() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-[#70787d]">
      <div className="flex items-center gap-1.5 text-2xl">
        <span className="animate-bounce">●</span>
        <span className="animate-bounce [animation-delay:0.15s]">●</span>
        <span className="animate-bounce [animation-delay:0.3s]">●</span>
      </div>
      <p className="text-xs">ИИ читает документ — это занимает 10–40 секунд.</p>
    </div>
  );
}

function AnalysisBody({ data }: { data: Analysis }) {
  const a = data.analysis;
  const meta: string[] = [];
  if (a.documentKind) meta.push(a.documentKind);
  if (a.doctorSpecialty) meta.push(a.doctorSpecialty);
  if (a.facility) meta.push(a.facility);

  return (
    <div className="space-y-3">
      <header className="rounded-2xl border border-[#e7e8e9] bg-[#f8f9fa] p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#70787d]">
          {meta.map((m, i) => (
            <span
              key={i}
              className="rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200"
            >
              {m}
            </span>
          ))}
          {a.visitDate ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200">
              <Calendar className="h-3 w-3" />
              {a.visitDate}
            </span>
          ) : null}
        </div>
        {a.summary ? (
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-[#191c1d]">
            {a.summary}
          </p>
        ) : null}
      </header>

      {a.complaints.length > 0 ? (
        <Section title="Жалобы">
          <UList items={a.complaints} />
        </Section>
      ) : null}

      {a.findings.length > 0 ? (
        <Section title="Что обнаружено / осмотр">
          <UList items={a.findings} />
        </Section>
      ) : null}

      {a.diagnoses.length > 0 ? (
        <Section title="Диагнозы из документа">
          <UList items={a.diagnoses} />
        </Section>
      ) : null}

      {a.prescriptions.length > 0 ? (
        <Section title="Назначения" icon={<Pill className="h-3.5 w-3.5" />}>
          <ul className="space-y-2">
            {a.prescriptions.map((p, i) => (
              <li
                key={i}
                className="rounded-xl border border-[#e7e8e9] bg-white p-2 text-[13px]"
              >
                <p className="font-semibold text-[#191c1d]">{p.name}</p>
                {p.dose ? (
                  <p className="text-xs text-[#70787d]">Доза: {p.dose}</p>
                ) : null}
                {p.schedule ? (
                  <p className="text-xs text-[#70787d]">Схема: {p.schedule}</p>
                ) : null}
                {p.reason ? (
                  <p className="text-xs text-[#70787d]">Зачем: {p.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {a.recommendations.length > 0 ? (
        <Section title="Рекомендации">
          <UList items={a.recommendations} />
        </Section>
      ) : null}

      {a.followUpDoctors.length > 0 ? (
        <Section
          title="К каким врачам стоит сходить"
          icon={<Stethoscope className="h-3.5 w-3.5" />}
        >
          <ul className="space-y-1.5 text-[13px]">
            {a.followUpDoctors.map((r, i) => (
              <li key={i}>
                <p className="font-medium capitalize text-[#191c1d]">{r.specialty}</p>
                {r.reason ? <p className="text-xs text-[#70787d]">{r.reason}</p> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {a.redFlags.length > 0 ? (
        <Section
          title="Что важно не пропустить"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          tone="warning"
        >
          <UList items={a.redFlags} />
        </Section>
      ) : null}

      {a.questionsForDoctor.length > 0 ? (
        <Section
          title="Вопросы врачу"
          icon={<HelpCircle className="h-3.5 w-3.5" />}
        >
          <UList items={a.questionsForDoctor} />
        </Section>
      ) : null}

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs leading-snug text-amber-900">
        {data.disclaimer}
      </p>
    </div>
  );
}

function Section({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  tone?: "warning";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-3",
        tone === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-[#e7e8e9] bg-white",
      )}
    >
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#70787d]">
        {icon} {title}
      </h4>
      {children}
    </section>
  );
}

function UList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-4 text-[13px] text-[#191c1d]">
      {items.map((q, i) => (
        <li key={i}>{q}</li>
      ))}
    </ul>
  );
}
