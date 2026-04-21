"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp, Loader2 } from "lucide-react";
import { uploadHealthDocument } from "@/app/actions/health-document";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/telegram-haptics";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "ANALYSIS", label: "Анализ" },
  { value: "DISCHARGE_SUMMARY", label: "Выписка" },
  { value: "PROTOCOL", label: "Протокол" },
  { value: "PRESCRIPTION", label: "Рецепт" },
  { value: "CONTRACT", label: "Договор" },
  { value: "OTHER", label: "Другое" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  profileId: string;
  onSuccess: () => void;
};

export function UploadHealthDocumentModal({ open, onClose, profileId, onSuccess }: Props) {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("OTHER");
  const [documentDate, setDocumentDate] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const reset = useCallback(() => {
    setBusy(false);
    setErr(null);
    setFile(null);
    setCategory("OTHER");
    setDocumentDate("");
    setTitle("");
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (!file) {
      setErr("Выберите файл.");
      return;
    }
    setErr(null);
    setBusy(true);
    hapticImpact("light");
    const fd = new FormData();
    fd.set("profileId", profileId);
    fd.set("file", file);
    fd.set("category", category);
    if (documentDate) fd.set("documentDate", documentDate);
    if (title.trim()) fd.set("title", title.trim());
    try {
      const r = await uploadHealthDocument(fd);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onSuccess();
      handleClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
        <h2 className="font-manrope text-lg font-bold text-health-text">Сохранить документ</h2>
        <p className="mt-1 text-caption text-health-text-secondary">
          Без расшифровки ИИ — файл попадёт в ваш архив. Дата с бланка — по желанию; иначе учтётся дата загрузки.
        </p>

        <label className="mt-4 block text-caption font-medium text-health-text-secondary">
          Файл (PDF, фото, DOC…)
          <input
            type="file"
            className="mt-1 block w-full text-sm"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className="mt-3 block text-caption font-medium text-health-text-secondary">
          Тип
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border-0 bg-slate-50 px-3 text-body text-health-text ring-1 ring-health-border/80"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-caption font-medium text-health-text-secondary">
          Дата на документе (необязательно)
          <input
            type="date"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border-0 bg-slate-50 px-3 text-body text-health-text ring-1 ring-health-border/80"
          />
        </label>

        <label className="mt-3 block text-caption font-medium text-health-text-secondary">
          Название (необязательно)
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: выписка из Ошского ЦРБ"
            className="mt-1 min-h-[44px] w-full rounded-xl border-0 bg-slate-50 px-3 text-body text-health-text ring-1 ring-health-border/80"
          />
        </label>

        {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="min-h-[48px] flex-1 rounded-2xl bg-slate-100 text-sm font-semibold text-slate-800"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !file}
            className={cn(
              "inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white",
              "bg-health-primary shadow-sm hover:bg-teal-700 disabled:opacity-50",
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
            Сохранить
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
