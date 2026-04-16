"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { uploadHealthRecord } from "@/app/actions/health-record";
import {
  isSupportedAnalysisMime,
  maskFileForPrivacyPreview,
} from "@/lib/client/mask-sensitive-document";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/telegram-haptics";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";
import { scrubPlainTextForStorage } from "@/lib/client/scrub-pii-text";

type Phase =
  | "idle"
  | "masking"
  | "anonymized"
  | "uploading"
  | "parsing"
  | "done"
  | "error";

type Props = {
  open: boolean;
  onClose: () => void;
  profileId: string;
  onSuccess: () => void;
};

export function UploadAnalysisModal({ open, onClose, profileId, onSuccess }: Props) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);
  /** Оригинал для сервера (Gemini читает без закрашенных зон превью). */
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [maskedBlob, setMaskedBlob] = useState<Blob | null>(null);
  const [maskedMime, setMaskedMime] = useState<string | null>(null);
  const [maskedObjectUrl, setMaskedObjectUrl] = useState<string | null>(null);

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
  }, []);

  const handleClose = () => {
    if (phase === "masking" || phase === "uploading" || phase === "parsing") return;
    reset();
    onClose();
  };

  const onPickFile = async (picked: File | null) => {
    if (!picked) return;
    setErr(null);
    if (!isSupportedAnalysisMime(picked.type)) {
      setErr("PDF же сүрөт гана (PNG, JPG, WEBP).");
      return;
    }

    setOriginalFile(picked);

    try {
      setPhase("masking");
      const { blob, mimeOut } = await maskFileForPrivacyPreview(picked);
      setMaskedBlob(blob);
      setMaskedMime(mimeOut);
      setPhase("anonymized");
    } catch {
      const fallbackMime = picked.type || "application/octet-stream";
      setErr(
        "Превью с маской недоступно. Нажмите «Загрузить» — уйдет оригинал файла (таблица не закрашена).",
      );
      setMaskedBlob(picked);
      setMaskedMime(fallbackMime);
      setPhase("anonymized");
    }
  };

  const submitWithOriginal = async (file: File) => {
    if (!isSupportedAnalysisMime(file.type)) {
      setErr("PDF же сүрөт гана (PNG, JPG, WEBP).");
      setPhase("error");
      return;
    }
    setErr(null);
    try {
      setPhase("uploading");
      const fd = new FormData();
      fd.set("profileId", profileId);
      fd.set("file", file);
      setPhase("parsing");
      const res = await uploadHealthRecord(fd);
      if (!res.ok) {
        setErr(res.error);
        setPhase("error");
        return;
      }
      setPhase("done");
      hapticImpact("medium");
      onSuccess();
      reset();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Жүктөө катасы");
      setPhase("error");
    }
  };

  const submitFromButton = () => {
    if (originalFile) void submitWithOriginal(originalFile);
  };

  if (!open || !mounted) return null;

  const anonymId = formatClinicalAnonymId(profileId);
  const scrubDemo = scrubPlainTextForStorage(
    "Пациент: Иванов Иван Иванович, ИНН: 123456789012,15.03.1988",
    anonymId,
  );

  const showImagePreview = maskedObjectUrl && maskedMime?.startsWith("image/");

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
        aria-label="Жабуу"
        onClick={handleClose}
      />
      <div className="relative my-auto w-full max-w-lg rounded-2xl border-2 border-emerald-800/25 bg-gradient-to-b from-mint/30 to-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-mint">
            <ShieldCheck className="h-6 w-6" strokeWidth={2} />
          </div>
          <div>
            <h2 id="upload-analysis-title" className="text-lg font-semibold text-emerald-950">
              Анализ жүктөө
            </h2>
            <p className="mt-0.5 text-sm text-emerald-900/75">
              Төмөндө — маскалонгон көрүнүш гана. Серверге жана Gemini&apos;ге{" "}
              <strong className="font-semibold text-emerald-950">чыкылдаган файл</strong> жөнөтүлөт (таблица
              көрүнөт). Псевдо-ID: <span className="font-mono text-emerald-950">{anonymId}</span>. Мисал
              текст скраббери:{" "}
              <span className="block break-all text-[11px] text-emerald-800/90">{scrubDemo}</span>
            </p>
          </div>
        </div>

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
            Сүйрөп киргизиңиз же басыңыз
          </p>
          <p className="relative z-[1] mt-1 text-xs text-emerald-600/70">PDF · PNG · JPG · WEBP</p>
        </div>

        {phase === "anonymized" || phase === "uploading" || phase === "parsing" ? (
          <div className="mt-3 rounded-xl border border-emerald-900/15 bg-emerald-900/5 p-3">
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-emerald-800/70">
              Маскалонгон көрүнүш (имитация) — жүктөө оригинал менен
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
                PDF: превьюдо кара тилкелер. Талдоо үчүн оригинал PDF жөнөтүлөт.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 space-y-2 rounded-xl bg-emerald-900/8 px-3 py-3 text-sm">
          {phase === "idle" ? (
            <p className="text-emerald-900/80">Файл тандаңыз.</p>
          ) : null}
          {phase === "masking" ? (
            <p className="flex items-center gap-2 font-medium text-emerald-950">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-800" />
              Анонимизация данных…
            </p>
          ) : null}
          {phase === "anonymized" ? (
            <p className="flex items-center gap-2 font-medium text-emerald-900">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Данные анонимизированы
            </p>
          ) : null}
          {(phase === "uploading" || phase === "parsing") && (
            <p className="flex items-center gap-2 font-medium text-emerald-950">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-800" />
              {phase === "uploading"
                ? "Жүктөлүүдө…"
                : "Распознавание показателей…"}
            </p>
          )}
          {phase === "done" ? (
            <p className="text-emerald-800">Сакталды.</p>
          ) : null}
          {phase === "error" && err ? (
            <p className="text-coral" role="alert">
              {err}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-medium text-emerald-900/80 hover:bg-emerald-900/5"
            onClick={handleClose}
            disabled={phase === "masking" || phase === "uploading" || phase === "parsing"}
          >
            Жабуу
          </button>
          <button
            type="button"
            className="rounded-xl bg-sakbol-cta px-4 py-2 text-sm font-medium text-white shadow-sm shadow-coral/25 transition-[filter] hover:brightness-[1.05] disabled:opacity-45"
            disabled={phase !== "anonymized" || !originalFile}
            onClick={() => void submitFromButton()}
          >
            Загрузить анализ
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
