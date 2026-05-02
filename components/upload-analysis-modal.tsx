"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp, Loader2, Plus, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import {
  isSupportedAnalysisMime,
  maskFileForPrivacyPreview,
} from "@/lib/client/mask-sensitive-document";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/telegram-haptics";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import { scrubPlainTextForStorage } from "@/lib/client/scrub-pii-text";
import { useLanguage } from "@/context/language-context";
import { t, type Lang } from "@/lib/i18n";
import type { ParsedBiomarker } from "@/types/biomarker";

type Phase =
  | "idle"
  | "masking"
  | "anonymized"
  | "ocr"
  | "review"
  | "saving"
  | "done"
  | "error";

type OcrDraft = {
  biomarkers: ParsedBiomarker[];
  analysisDate?: string;
  labName?: string;
  ocrParser: "gemini" | "openai" | "mock";
};

type Props = {
  open: boolean;
  onClose: () => void;
  profileId: string;
  onSuccess: () => void;
};

function emptyRow(): ParsedBiomarker {
  return { biomarker: "", value: 0, unit: "", reference: "" };
}

function transportErr(lang: Lang, httpStatus: number): string {
  if (httpStatus === 413) return t(lang, "uploadLab.errPayloadTooLarge");
  return t(lang, "uploadLab.errServerTransport");
}

async function fetchLabJson<T>(url: string, fd: FormData, lang: Lang): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
  } catch {
    throw new Error(t(lang, "uploadLab.errNetwork"));
  }
  const ct = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  if (!ct.includes("application/json")) {
    throw new Error(transportErr(lang, res.status));
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(transportErr(lang, res.status));
  }
}

export function UploadAnalysisModal({ open, onClose, profileId, onSuccess }: Props) {
  const { lang } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);
  /** Оригинал для сервера (Gemini читает без закрашенных зон превью). */
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [maskedBlob, setMaskedBlob] = useState<Blob | null>(null);
  const [maskedMime, setMaskedMime] = useState<string | null>(null);
  const [maskedObjectUrl, setMaskedObjectUrl] = useState<string | null>(null);

  const [ocrDraft, setOcrDraft] = useState<OcrDraft | null>(null);
  const [analysisDate, setAnalysisDate] = useState("");
  const [labName, setLabName] = useState("");
  const [recordTitle, setRecordTitle] = useState("");
  const [rows, setRows] = useState<ParsedBiomarker[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!maskedBlob || !maskedMime?.startsWith("image/")) {
      setMaskedObjectUrl(null);
      return;
    }
    const u = URL.createObjectURL(maskedBlob);
    setMaskedObjectUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [maskedBlob, maskedMime]);

  const reset = useCallback(() => {
    setPhase("idle");
    setErr(null);
    setOriginalFile(null);
    setMaskedBlob(null);
    setMaskedMime(null);
    setOcrDraft(null);
    setAnalysisDate("");
    setLabName("");
    setRecordTitle("");
    setRows([]);
  }, []);

  const handleClose = () => {
    if (phase === "masking" || phase === "ocr" || phase === "saving") return;
    reset();
    onClose();
  };

  const onPickFile = async (picked: File | null) => {
    if (!picked) return;
    setErr(null);
    if (!isSupportedAnalysisMime(picked.type)) {
      setErr(t(lang, "uploadLab.errMime"));
      return;
    }

    setOriginalFile(picked);
    setOcrDraft(null);
    setRows([]);

    try {
      setPhase("masking");
      const { blob, mimeOut } = await maskFileForPrivacyPreview(picked);
      setMaskedBlob(blob);
      setMaskedMime(mimeOut);
      setPhase("anonymized");
    } catch {
      const fallbackMime = picked.type || "application/octet-stream";
      setErr(t(lang, "uploadLab.errMaskFallback"));
      setMaskedBlob(picked);
      setMaskedMime(fallbackMime);
      setPhase("anonymized");
    }
  };

  const runOcr = async () => {
    if (!originalFile) return;
    setErr(null);
    setPhase("ocr");
    try {
      const fd = new FormData();
      fd.set("profileId", profileId);
      fd.set("file", originalFile);
      type Preview =
        | {
            ok: true;
            draft: OcrDraft;
          }
        | { ok: false; error: string };
      const res = await fetchLabJson<Preview>("/api/documents/lab-ocr-preview", fd, lang);
      if (!res.ok) {
        setErr(res.error);
        setPhase("error");
        return;
      }
      const d = res.draft;
      setOcrDraft(d);
      setRows(d.biomarkers.map((b) => ({ ...b })));
      setAnalysisDate(d.analysisDate ?? "");
      setLabName(d.labName ?? "");
      setRecordTitle("");
      setPhase("review");
      hapticImpact("light");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t(lang, "uploadLab.errOcr"));
      setPhase("error");
    }
  };

  const updateRow = (index: number, patch: Partial<ParsedBiomarker>) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      next[index] = { ...cur, ...patch };
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const commit = async () => {
    if (!originalFile || !ocrDraft) return;
    const valid = rows.filter((r) => r.biomarker.trim() && Number.isFinite(r.value));
    if (valid.length === 0) {
      setErr(t(lang, "uploadLab.errNoRows"));
      return;
    }
    setErr(null);
    setPhase("saving");
    try {
      const payload = JSON.stringify({
        biomarkers: valid.map((r) => ({
          biomarker: r.biomarker.trim(),
          value: r.value,
          unit: r.unit.trim(),
          reference: r.reference.trim(),
        })),
        ...(analysisDate.trim() ? { analysisDate: analysisDate.trim() } : {}),
        ...(labName.trim() ? { labName: labName.trim() } : {}),
        ...(recordTitle.trim() ? { title: recordTitle.trim() } : {}),
        ocrParser: ocrDraft.ocrParser,
      });
      const fd = new FormData();
      fd.set("profileId", profileId);
      fd.set("file", originalFile);
      fd.set("payload", payload);
      type Commit = { ok: true } | { ok: false; error: string };
      const res = await fetchLabJson<Commit>("/api/documents/lab-ocr-commit", fd, lang);
      if (!res.ok) {
        setErr(res.error);
        setPhase("error");
        return;
      }
      hapticImpact("medium");
      onSuccess();
      reset();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t(lang, "uploadLab.errSave"));
      setPhase("error");
    }
  };

  if (!open || !mounted) return null;

  const anonymId = formatClinicalAnonymId(profileId);
  const scrubDemo = scrubPlainTextForStorage(
    "Пациент: Иванов Иван Иванович, ИНН: 123456789012,15.03.1988",
    anonymId,
  );

  const showImagePreview = maskedObjectUrl && maskedMime?.startsWith("image/");
  const busy = phase === "masking" || phase === "ocr" || phase === "saving";

  const overlay = (
    <div
      className="fixed inset-0 z-[110] flex max-h-[100dvh] items-end justify-center overflow-y-auto bg-emerald-950/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-analysis-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t(lang, "uploadLab.ariaCloseOverlay")}
        onClick={handleClose}
      />
      <div className="relative my-auto max-h-[min(92dvh,860px)] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-emerald-800/25 bg-gradient-to-b from-mint/30 to-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-mint">
            <ShieldCheck className="h-6 w-6" strokeWidth={2} />
          </div>
          <div>
            <h2 id="upload-analysis-title" className="text-lg font-semibold text-emerald-950">
              {t(lang, "uploadLab.title")}
            </h2>
            <p className="mt-0.5 text-sm text-emerald-900/75">
              {t(lang, "uploadLab.helpIntro")}{" "}
              <strong className="font-semibold text-emerald-950">
                {t(lang, "uploadLab.helpOriginalEmphasis")}
              </strong>{" "}
              {t(lang, "uploadLab.helpMid")}{" "}
              <span className="font-mono text-emerald-950">{anonymId}</span>. {t(lang, "uploadLab.helpScrubLead")}{" "}
              <span className="block break-all text-[11px] text-emerald-800/90">{scrubDemo}</span>
            </p>
          </div>
        </div>

        {phase !== "review" ? (
          <div
            className={cn(
              "relative mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-emerald-700/35 bg-white/70 px-4 py-8 text-center transition-colors hover:border-emerald-600/50",
              phase === "masking" && "pointer-events-none opacity-80",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              void onPickFile(e.dataTransfer.files[0] ?? null);
            }}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "application/pdf,image/png,image/jpeg,image/webp";
              input.onchange = () => void onPickFile(input.files?.[0] ?? null);
              input.click();
            }}
          >
            {phase === "masking" ? (
              <div
                className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[10px]"
                aria-hidden
              >
                <div className="absolute inset-x-0 h-14 animate-sakbol-scan bg-gradient-to-b from-transparent via-emerald-400/50 to-transparent blur-[1px]" />
              </div>
            ) : null}
            <FileUp className="relative z-[1] mx-auto h-10 w-10 text-emerald-800/60" />
            <p className="relative z-[1] mt-2 text-sm font-semibold text-emerald-950">
              {t(lang, "uploadLab.dropHint")}
            </p>
            <p className="relative z-[1] mt-1 text-xs text-emerald-600/70">PDF · PNG · JPG · WEBP</p>
          </div>
        ) : null}

        {phase === "anonymized" || phase === "ocr" || phase === "saving" || phase === "error" ? (
          <div className="mt-3 rounded-xl border border-emerald-900/15 bg-emerald-900/5 p-3">
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-emerald-800/70">
              {t(lang, "uploadLab.maskCaption")}
            </p>
            {showImagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={maskedObjectUrl!}
                alt=""
                className="mx-auto max-h-48 rounded-lg object-contain"
              />
            ) : maskedMime === "application/pdf" ? (
              <p className="py-6 text-center text-sm text-emerald-900/80">
                {t(lang, "uploadLab.pdfPreviewNote")}
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === "review" && ocrDraft ? (
          <div className="mt-4 space-y-3 rounded-xl border border-emerald-900/20 bg-white/90 p-3 text-sm text-emerald-950 shadow-inner">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">
              {t(lang, "uploadLab.reviewHint")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-caption text-emerald-900/70">{t(lang, "uploadLab.dateLabel")}</span>
                <input
                  type="date"
                  className="rounded-lg border border-emerald-900/20 bg-white px-2 py-1.5 text-sm"
                  value={analysisDate}
                  onChange={(e) => setAnalysisDate(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-caption text-emerald-900/70">{t(lang, "uploadLab.labLabel")}</span>
                <input
                  type="text"
                  className="rounded-lg border border-emerald-900/20 bg-white px-2 py-1.5 text-sm"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  placeholder={t(lang, "uploadLab.labPlaceholder")}
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-caption text-emerald-900/70">
                  {t(lang, "uploadLab.recordTitleLabel")}
                </span>
                <input
                  type="text"
                  className="rounded-lg border border-emerald-900/20 bg-white px-2 py-1.5 text-sm"
                  value={recordTitle}
                  onChange={(e) => setRecordTitle(e.target.value)}
                  placeholder={t(lang, "uploadLab.recordTitlePlaceholder")}
                />
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-emerald-900/15">
              <table className="w-full min-w-[320px] text-left text-caption">
                <thead className="bg-emerald-900/10 text-[11px] uppercase text-emerald-900/80">
                  <tr>
                    <th className="px-2 py-2">{t(lang, "uploadLab.colBiomarker")}</th>
                    <th className="px-2 py-2">{t(lang, "uploadLab.colValue")}</th>
                    <th className="px-2 py-2">{t(lang, "uploadLab.colUnit")}</th>
                    <th className="px-2 py-2">{t(lang, "uploadLab.colRef")}</th>
                    <th className="w-10 px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-emerald-900/10">
                      <td className="px-1 py-1">
                        <input
                          className="w-full min-w-[100px] rounded border border-transparent bg-white/80 px-1 py-0.5 text-sm focus:border-emerald-600"
                          value={row.biomarker}
                          onChange={(e) => updateRow(i, { biomarker: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          step="any"
                          className="w-20 rounded border border-transparent bg-white/80 px-1 py-0.5 text-sm focus:border-emerald-600"
                          value={Number.isFinite(row.value) ? row.value : ""}
                          onChange={(e) => updateRow(i, { value: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          className="w-14 rounded border border-transparent bg-white/80 px-1 py-0.5 text-sm focus:border-emerald-600"
                          value={row.unit}
                          onChange={(e) => updateRow(i, { unit: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          className="w-20 rounded border border-transparent bg-white/80 px-1 py-0.5 text-sm focus:border-emerald-600"
                          value={row.reference}
                          onChange={(e) => updateRow(i, { reference: e.target.value })}
                        />
                      </td>
                      <td className="px-0 py-1 text-center">
                        <button
                          type="button"
                          className="rounded p-1 text-emerald-900/50 hover:bg-red-50 hover:text-red-600"
                          aria-label={t(lang, "uploadLab.removeRowAria")}
                          onClick={() => removeRow(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 text-caption font-medium text-emerald-800 hover:text-emerald-950"
              onClick={addRow}
            >
              <Plus className="h-4 w-4" />
              {t(lang, "uploadLab.addRow")}
            </button>
          </div>
        ) : null}

        <div className="mt-4 space-y-2 rounded-xl bg-emerald-900/8 px-3 py-3 text-sm">
          {phase === "idle" ? (
            <p className="text-emerald-900/80">{t(lang, "uploadLab.pickFile")}</p>
          ) : null}
          {phase === "masking" ? (
            <p className="flex items-center gap-2 font-medium text-emerald-950">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-800" />
              {t(lang, "uploadLab.masking")}
            </p>
          ) : null}
          {phase === "anonymized" ? (
            <p className="flex items-center gap-2 font-medium text-emerald-900">
              <Sparkles className="h-4 w-4 text-amber-600" />
              {t(lang, "uploadLab.readyRecognize")}
            </p>
          ) : null}
          {phase === "ocr" || phase === "saving" ? (
            <p className="flex items-center gap-2 font-medium text-emerald-950">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-800" />
              {phase === "ocr" ? t(lang, "uploadLab.ocrBusy") : t(lang, "uploadLab.savingBusy")}
            </p>
          ) : null}
          {phase === "done" ? (
            <p className="text-emerald-800">{t(lang, "uploadLab.saved")}</p>
          ) : null}
          {phase === "error" && err ? (
            <p className="text-coral" role="alert">
              {err}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-medium text-emerald-900/80 hover:bg-emerald-900/5"
            onClick={handleClose}
            disabled={busy}
          >
            {t(lang, "uploadLab.close")}
          </button>
          {phase === "review" ? (
            <>
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-medium text-emerald-900/80 hover:bg-emerald-900/5"
                onClick={() => {
                  setPhase("anonymized");
                  setErr(null);
                }}
                disabled={busy}
              >
                {t(lang, "uploadLab.back")}
              </button>
              <button
                type="button"
                className="rounded-xl bg-sakbol-cta px-4 py-2 text-sm font-medium text-white shadow-sm shadow-coral/25 transition-[filter] hover:brightness-[1.05] disabled:opacity-45"
                disabled={busy}
                onClick={() => void commit()}
              >
                {t(lang, "uploadLab.save")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rounded-xl bg-sakbol-cta px-4 py-2 text-sm font-medium text-white shadow-sm shadow-coral/25 transition-[filter] hover:brightness-[1.05] disabled:opacity-45"
              disabled={phase !== "anonymized" || !originalFile || busy}
              onClick={() => void runOcr()}
            >
              {t(lang, "uploadLab.recognize")}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
