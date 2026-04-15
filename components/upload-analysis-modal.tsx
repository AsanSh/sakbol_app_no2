"use client";

import { useCallback, useEffect, useState } from "react";
import { FileUp, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { uploadHealthRecord } from "@/app/actions/health-record";
import {
  isSupportedAnalysisMime,
  maskFileForPrivacyPreview,
} from "@/lib/client/mask-sensitive-document";
import { cn } from "@/lib/utils";
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
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [maskedBlob, setMaskedBlob] = useState<Blob | null>(null);
  const [maskedMime, setMaskedMime] = useState<string | null>(null);
  const [maskedObjectUrl, setMaskedObjectUrl] = useState<string | null>(null);

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
    setMaskedBlob(null);
    setMaskedMime(null);
  }, []);

  const handleClose = () => {
    if (phase === "masking" || phase === "uploading" || phase === "parsing") return;
    reset();
    onClose();
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setErr(null);
    if (!isSupportedAnalysisMime(file.type)) {
      setErr("PDF же сүрөт гана (PNG, JPG, WEBP).");
      return;
    }

    try {
      setPhase("masking");
      const { blob, mimeOut } = await maskFileForPrivacyPreview(file);
      setMaskedBlob(blob);
      setMaskedMime(mimeOut);
      setPhase("anonymized");
      await submit(blob, mimeOut);
    } catch {
      // Если маскирование не сработало в WebView/браузере, не блокируем основной сценарий.
      const fallbackMime = file.type || "application/octet-stream";
      setErr("Маскирование недоступно, файл будет загружен без превью.");
      setMaskedBlob(file);
      setMaskedMime(fallbackMime);
      setPhase("anonymized");
      await submit(file, fallbackMime);
    }
  };

  const submit = async (blobArg?: Blob, mimeArg?: string) => {
    const blob = blobArg ?? maskedBlob;
    const mime = mimeArg ?? maskedMime;
    if (!blob || !mime) return;
    setErr(null);
    try {
      setPhase("uploading");
      const file = new File([blob], "masked.bin", { type: mime });
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
      onSuccess();
      reset();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Жүктөө катасы");
      setPhase("error");
    }
  };

  if (!open) return null;

  const anonymId = formatClinicalAnonymId(profileId);
  const scrubDemo = scrubPlainTextForStorage(
    "Пациент: Иванов Иван Иванович, ИНН: 123456789012,15.03.1988",
    anonymId,
  );

  const showImagePreview = maskedObjectUrl && maskedMime?.startsWith("image/");

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-emerald-950/50 p-4 sm:items-center"
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
      <div className="relative w-full max-w-lg rounded-2xl border-2 border-emerald-800/25 bg-gradient-to-b from-mint/30 to-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-mint">
            <ShieldCheck className="h-6 w-6" strokeWidth={2} />
          </div>
          <div>
            <h2 id="upload-analysis-title" className="text-lg font-semibold text-emerald-950">
              Анализ жүктөө
            </h2>
            <p className="mt-0.5 text-sm text-emerald-900/75">
              Клиентте маскалоо + псевдо-ID <span className="font-mono text-emerald-950">{anonymId}</span>.
              Тексттик демо-скрабинг:{" "}
              <span className="block break-all text-[11px] text-emerald-800/90">{scrubDemo}</span>
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-700/35 bg-white/70 px-4 py-8 text-center transition-colors hover:border-emerald-600/50",
            phase === "masking" && "pointer-events-none opacity-70",
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
          <FileUp className="mx-auto h-10 w-10 text-emerald-800/60" />
          <p className="mt-2 text-sm font-medium text-emerald-950">
            Сүйрөп киргизиңиз же басыңыз
          </p>
          <p className="mt-1 text-xs text-emerald-800/65">PDF · PNG · JPG · WEBP</p>
        </div>

        {phase === "anonymized" || phase === "uploading" || phase === "parsing" ? (
          <div className="mt-3 rounded-xl border border-emerald-900/15 bg-emerald-900/5 p-3">
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-emerald-800/70">
              Маскалонгон көрүнүш (имитация)
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
                PDF: документке кара тилкелер кошулду. Сервер окуу үчүн файлды кийинки этапта иштетет.
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
            className="rounded-xl bg-emerald-900 px-4 py-2 text-sm font-medium text-mint disabled:opacity-45"
            disabled={phase !== "anonymized" || !maskedBlob}
            onClick={() => void submit()}
          >
            Загрузить анализ
          </button>
        </div>
      </div>
    </div>
  );
}
