"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type Mentioned = { id: string; displayName: string } | null;

type Props = {
  open: boolean;
  onClose: () => void;
  profileId: string;
  onSuccess: () => void;
};

type Phase = "idle" | "analyzing" | "ready";

export function UploadHealthDocumentModal({ open, onClose, profileId, onSuccess }: Props) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("OTHER");
  const [documentDate, setDocumentDate] = useState("");
  const [title, setTitle] = useState("");
  const [mentionHint, setMentionHint] = useState<Mentioned>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setBusy(false);
    setErr(null);
    setFiles([]);
    setCategory("OTHER");
    setDocumentDate("");
    setTitle("");
    setMentionHint(null);
    setProgress(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const runExtract = useCallback(
    async (f: File) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setPhase("analyzing");
      setErr(null);
      setMentionHint(null);
      try {
        const fd = new FormData();
        fd.set("file", f);
        const r = await fetch("/api/documents/extract-metadata", {
          method: "POST",
          body: fd,
          credentials: "include",
          signal: ac.signal,
        });
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          title?: string;
          category?: string;
          documentDate?: string | null;
          mentionedProfile?: Mentioned;
        };
        if (!r.ok || !j.ok) {
          throw new Error(j.error || "Не удалось разобрать файл");
        }
        if (ac.signal.aborted) return;
        setTitle(typeof j.title === "string" ? j.title : "");
        if (j.category && CATEGORIES.some((c) => c.value === j.category)) {
          setCategory(j.category);
        }
        setDocumentDate(j.documentDate ?? "");
        setMentionHint(j.mentionedProfile ?? null);
        setPhase("ready");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setPhase("ready");
        setErr(e instanceof Error ? e.message : "Ошибка анализа");
      }
    },
    [],
  );

  const handleClose = () => {
    if (busy || phase === "analyzing") return;
    reset();
    onClose();
  };

  const onFileChange = (pickedList: FileList | null) => {
    const next = pickedList ? Array.from(pickedList).slice(0, 10) : [];
    setFiles(next);
    if (next.length === 0) {
      setPhase("idle");
      setTitle("");
      setDocumentDate("");
      setCategory("OTHER");
      setMentionHint(null);
      return;
    }
    if (next.length > 1) {
      setPhase("ready");
      setTitle("");
      setDocumentDate("");
      setMentionHint(null);
      return;
    }
    void runExtract(next[0]);
  };

  const submit = async () => {
    if (files.length === 0) {
      setErr("Выберите файл(ы).");
      return;
    }
    if (phase === "analyzing") {
      setErr("Дождитесь окончания анализа.");
      return;
    }
    setErr(null);
    setBusy(true);
    hapticImpact("light");
    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length });
        const fd = new FormData();
        fd.set("profileId", profileId);
        fd.set("file", file);
        fd.set("category", category);
        // Для пачки полагаемся на автопарсер каждого файла; ручные поля — только для одиночного.
        if (files.length === 1) {
          if (documentDate) fd.set("documentDate", documentDate);
          if (title.trim()) fd.set("title", title.trim());
        }
        const r = await uploadHealthDocument(fd);
        if (!r.ok) {
          setErr(
            files.length > 1
              ? `Файл ${i + 1}/${files.length}: ${r.error}`
              : r.error,
          );
          return;
        }
      }
      onSuccess();
      handleClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
      setProgress(null);
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
          PDF и фото: дата и тип подставляются автоматически (можно исправить). Если дату не удалось
          распознать, в списке будет дата загрузки.
        </p>

        <label className="mt-4 block text-caption font-medium text-health-text-secondary">
          Файлы (до 10): PDF, фото, DOC…
          <input
            type="file"
            className="mt-1 block w-full text-sm"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
            multiple
            disabled={busy || phase === "analyzing"}
            onChange={(e) => onFileChange(e.target.files)}
          />
        </label>
        {files.length > 0 ? (
          <p className="mt-2 text-caption text-health-text-secondary">
            Выбрано: {files.length} из 10
          </p>
        ) : null}
        {files.length > 1 ? (
          <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-2 text-[12px] text-slate-700 ring-1 ring-health-border/80">
            {files.map((f) => (
              <li key={`${f.name}-${f.size}`} className="truncate">
                {f.name}
              </li>
            ))}
          </ul>
        ) : null}

        {phase === "analyzing" ? (
          <div
            className="mt-4 flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 py-8 ring-1 ring-health-border/80"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin text-health-primary" aria-hidden />
            <p className="text-center text-sm font-medium text-health-text">Анализирую документ…</p>
            <p className="max-w-xs text-center text-caption text-health-text-secondary">
              Извлекаю текст и ищу дату на бланке. Для фото это может занять до минуты.
            </p>
          </div>
        ) : (
          <>
            <label className="mt-4 block text-caption font-medium text-health-text-secondary">
              Тип
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={busy}
                className="mt-1 min-h-[44px] w-full rounded-xl border-0 bg-slate-50 px-3 text-body text-health-text ring-1 ring-health-border/80"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            {files.length <= 1 ? (
              <>
                <label className="mt-3 block text-caption font-medium text-health-text-secondary">
                  Дата на документе (необязательно)
                  <input
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                    disabled={busy}
                    className="mt-1 min-h-[44px] w-full rounded-xl border-0 bg-slate-50 px-3 text-body text-health-text ring-1 ring-health-border/80"
                  />
                </label>

                <label className="mt-3 block text-caption font-medium text-health-text-secondary">
                  Название
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={busy}
                    placeholder="Например: выписка из Ошского ЦРБ"
                    className="mt-1 min-h-[44px] w-full rounded-xl border-0 bg-slate-50 px-3 text-body text-health-text ring-1 ring-health-border/80"
                  />
                </label>

                {mentionHint && mentionHint.id !== profileId ? (
                  <p className="mt-3 rounded-xl bg-amber-50/95 px-3 py-2 text-caption text-amber-950 ring-1 ring-amber-200/80">
                    В тексте встречается «{mentionHint.displayName}». Убедитесь, что сохраняете файл в
                    нужный профиль семьи.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-caption text-slate-700 ring-1 ring-health-border/80">
                Для пачки файлов дата и название определяются автоматически по каждому файлу.
              </p>
            )}
          </>
        )}

        {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}
        {busy && progress ? (
          <p className="mt-2 text-xs text-health-text-secondary">
            Загружаю {progress.current} из {progress.total}…
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy || phase === "analyzing"}
            className="min-h-[48px] flex-1 rounded-2xl bg-slate-100 text-sm font-semibold text-slate-800"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || files.length === 0 || phase === "analyzing"}
            className={cn(
              "inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white",
              "bg-health-primary shadow-sm hover:bg-teal-700 disabled:opacity-50",
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
            {files.length > 1 ? "Сохранить все" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
