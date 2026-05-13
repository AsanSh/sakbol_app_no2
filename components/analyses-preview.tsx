"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import useSWRInfinite from "swr/infinite";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileDown,
  FileText,
  Loader2,
  PlusCircle,
  RefreshCw,
  Share2,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { listLabAnalysesForProfile } from "@/app/actions/analyses";
import { deleteHealthDocument, updateHealthDocumentMeta } from "@/app/actions/health-document";
import { deleteLabAnalysis } from "@/app/actions/health-record";
import { createShareToken } from "@/app/actions/share";
import { useLanguage } from "@/context/language-context";
import type { LabAnalysisRow, ProfileSummary } from "@/types/family";
import { useActiveProfile } from "@/context/active-profile-context";
import type { HealthRecordAnalysisPayload } from "@/types/biomarker";
import { AnalysisSkeleton } from "@/components/analysis-skeleton";
import { BiomarkerChart } from "@/components/biomarker-chart";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import {
  analysisWorstStatus,
  buildBiomarkerSeries,
  getNormForBiomarker,
  getStatusColorHex,
  ageInMonthsFromDob,
  listBiomarkersWithDynamics,
  normalizeBiomarkerKey,
  statusForBiomarker,
  unitForBiomarkerKey,
  type MedicalStatus,
} from "@/lib/medical-logic";
import type { ParsedBiomarker } from "@/types/biomarker";
import { categoryForBiomarkerKey } from "@/constants/biomarker-categories";
import { downloadLabPdfClient } from "@/lib/download-lab-pdf";
import { AnalysisComparePanel } from "@/components/analysis-compare-panel";
import { archivePrimaryDateLabel, ARCHIVE_CATEGORY_RU } from "@/lib/archive-display-dates";
import { effectiveAnalysisTimeMs } from "@/lib/lab-analysis-dates";
import { DocumentAiAnalysisModal } from "@/components/sakbol/ai/document-analysis-modal";
import { downloadDoctorReportPdf } from "@/lib/client/download-doctor-report-pdf";

type HealthDocRow = {
  id: string;
  title: string;
  fileUrl: string;
  category: string;
  documentDate: string | null;
  createdAt: string;
  mimeType: string | null;
};

type DocEditDraft = {
  id: string;
  title: string;
  category: string;
  documentDate: string;
};

type UnifiedItem =
  | { kind: "lab"; sortMs: number; lab: LabAnalysisRow }
  | { kind: "doc"; sortMs: number; doc: HealthDocRow };

type DocumentsPage = {
  documents: HealthDocRow[];
  hasMore?: boolean;
  nextCursor?: string | null;
};

type DocTranslateLang = "ru" | "en" | "hi";

const DOC_TRANSLATE_LANG_LABEL: Record<DocTranslateLang, string> = {
  ru: "Русский",
  en: "English",
  hi: "हिन्दी (Hindi)",
};

const documentsFetcher = async (url: string): Promise<DocumentsPage> => {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("documents_fetch_failed");
  return (await r.json()) as DocumentsPage;
};

function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp);
}

/** Перевод PDF: длинный серверный запрос + DeepSeek — мягкий retry при обрыве сети. */
async function postDocumentTranslate(
  docId: string,
  targetLang: DocTranslateLang,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const url = `/api/documents/${encodeURIComponent(docId)}/translate`;
  const body = JSON.stringify({ targetLang });
  const maxAttempts = 2;
  let lastErr = "Не удалось выполнить запрос.";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 180_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body,
        signal: ctrl.signal,
      });
      window.clearTimeout(timer);
      const raw = await res.text();
      let j: { error?: string; text?: string } = {};
      if (raw) {
        try {
          j = JSON.parse(raw) as { error?: string; text?: string };
        } catch {
          return {
            ok: false,
            error: `Сервер вернул неожиданный ответ (${res.status}). Попробуйте позже.`,
          };
        }
      }
      if (!res.ok) {
        lastErr = j.error || `Ошибка ${res.status}`;
        if (res.status >= 502 && attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 1800));
          continue;
        }
        return { ok: false, error: lastErr };
      }
      return { ok: true, text: String(j.text ?? "") };
    } catch (e) {
      window.clearTimeout(timer);
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError") {
        lastErr =
          "Слишком долгое ожидание (медленный интернет или тяжёлый PDF). Попробуйте ещё раз.";
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        lastErr =
          /fetch|network|failed/i.test(msg) || name === "TypeError"
            ? "Нет связи с сервером. Проверьте интернет и попробуйте снова."
            : msg.slice(0, 160);
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  return { ok: false, error: lastErr };
}

const DocumentSkeleton = () => (
  <div className="flex items-center gap-3 rounded-xl bg-white p-3 animate-pulse">
    <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-gray-200" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-1/4 rounded bg-gray-200" />
      <div className="h-4 w-3/4 rounded bg-gray-200" />
      <div className="h-3 w-1/2 rounded bg-gray-200" />
    </div>
    <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gray-100" />
  </div>
);

function biomarkerCount(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const d = data as HealthRecordAnalysisPayload;
  return Array.isArray(d.biomarkers) ? d.biomarkers.length : null;
}

function fileTypeLabel(mime: string | undefined): string {
  if (!mime) return "—";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("image")) return "IMG";
  const p = mime.split("/").pop();
  return p ? p.toUpperCase() : "—";
}

function labNameFromRow(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const n = d.labName;
  return typeof n === "string" && n.trim() ? n.trim() : null;
}

function cardTone(worst: MedicalStatus): string {
  if (worst === "critical") {
    return "bg-red-50/90 shadow-md ring-1 ring-red-200/80";
  }
  if (worst === "warning") {
    return "bg-amber-50/70 shadow-md ring-1 ring-amber-200/70";
  }
  return "bg-health-surface shadow-md ring-1 ring-health-border/80";
}

function statusIndicatorPillClass(st: MedicalStatus): string {
  if (st === "critical") return "bg-red-100 text-red-900 ring-1 ring-red-200/70";
  if (st === "warning") return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/70";
  return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70";
}

type Props = {
  profiles: ProfileSummary[];
  refreshKey?: number;
  /** Пустой список: кнопка «жүктөө» открывает загрузку (родитель). */
  onRequestUpload?: () => void;
  /** Десктоп: уместить в одну колонку без прокрутки — до 2 карточек, без динамики и лишнего текста */
  compact?: boolean;
  /** В compact при клике по карточке — перейти к полной вкладке анализов */
  onOpenAnalyses?: () => void;
  /** Вкладка «Динамика»: только сравнение и графики, без списка карточек. */
  mode?: "default" | "trends";
  /** Скрыть H2 и подпись (родитель уже дал контекст, напр. блок «Обследования»). */
  hideHeader?: boolean;
  /** Архив: без фильтров по «норма/критично» и без цветовых статусов в списке. */
  archiveNeutral?: boolean;
  /** Кнопка «Медицинский отчёт для врача (PDF)» (напр. дашборд «Обследования»). */
  showDoctorReportPdf?: boolean;
};

export function AnalysesPreview({
  profiles,
  refreshKey = 0,
  onRequestUpload,
  compact = false,
  onOpenAnalyses,
  mode = "default",
  hideHeader = false,
  archiveNeutral = false,
  showDoctorReportPdf = false,
}: Props) {
  const { lang } = useLanguage();
  const { activeProfileId } = useActiveProfile();
  const [doctorReportBusy, setDoctorReportBusy] = useState(false);
  const isTrends = mode === "trends";
  const [rows, setRows] = useState<LabAnalysisRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeShare, setActiveShare] = useState<{ recordId: string; url: string } | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<{ id: string; msg: string } | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | MedicalStatus>("all");
  const [trendsRangeDays, setTrendsRangeDays] = useState<number | null>(null);
  const [trendsFocusKey, setTrendsFocusKey] = useState<string | null>(null);
  const [deleteDocBusyId, setDeleteDocBusyId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocEditDraft | null>(null);
  const [editDocBusy, setEditDocBusy] = useState(false);
  const [editDocError, setEditDocError] = useState<string | null>(null);
  const [openDocBusyId, setOpenDocBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshTick, setAutoRefreshTick] = useState(0);
  const [manualSyncTick, setManualSyncTick] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [aiDocModal, setAiDocModal] = useState<{ id: string; title: string } | null>(null);

  type DocMenuPhase = "actions" | "language";
  const [docActionMenu, setDocActionMenu] = useState<{
    doc: HealthDocRow;
    phase: DocMenuPhase;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  const docMenuPanelRef = useRef<HTMLDivElement>(null);
  const [docMenuFixedPos, setDocMenuFixedPos] = useState({ left: 0, top: 0 });

  const [docTranslation, setDocTranslation] = useState<{
    docId: string;
    title: string;
    targetLang: DocTranslateLang;
    langLabel: string;
    text: string;
    loading: boolean;
    error: string | null;
  } | null>(null);

  const [shareToast, setShareToast] = useState<string | null>(null);

  const docLongPressRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    fired: boolean;
    startX: number;
    startY: number;
  }>({ timer: null, fired: false, startX: 0, startY: 0 });

  /** В Telegram Mini App нельзя открыть blob в новой вкладке — показываем файл внутри приложения с кнопкой «Назад». */
  const [documentPreview, setDocumentPreview] = useState<{
    title: string;
    blobUrl: string;
    mimeType: string;
  } | null>(null);

  /** Увеличение контента двойным тапом (pinch на листе конфликтует с Telegram и закрывает мини-приложение). */
  const [docPreviewMagnified, setDocPreviewMagnified] = useState(false);
  const docPreviewTapRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const docPreviewLastTapEndRef = useRef(0);

  useEffect(() => {
    if (documentPreview) {
      setDocPreviewMagnified(false);
      docPreviewTapRef.current = null;
      docPreviewLastTapEndRef.current = 0;
    }
  }, [documentPreview]);

  const registerDocPreviewTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      docPreviewTapRef.current = null;
      return;
    }
    const t = e.touches[0];
    docPreviewTapRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onDocPreviewContentTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const st = docPreviewTapRef.current;
    docPreviewTapRef.current = null;
    if (!st) return;
    if (Date.now() - st.t > 550) return;
    if (Math.hypot(t.clientX - st.x, t.clientY - st.y) > 22) return;

    const now = Date.now();
    const prev = docPreviewLastTapEndRef.current;
    if (prev > 0 && now - prev < 340) {
      setDocPreviewMagnified((m) => !m);
      docPreviewLastTapEndRef.current = 0;
    } else {
      docPreviewLastTapEndRef.current = now;
    }
  };

  const onDocPreviewContentDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setDocPreviewMagnified((m) => !m);
  };

  const closeDocumentPreview = useCallback(() => {
    setDocumentPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  }, []);

  useEffect(() => {
    closeDocumentPreview();
  }, [activeProfileId, closeDocumentPreview]);

  useEffect(() => {
    if (!documentPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDocumentPreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [documentPreview, closeDocumentPreview]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const lastLabPidRef = useRef<string | null>(null);
  const labReqIdRef = useRef(0);

  const docsApiUrl =
    activeProfileId && !isTrends ? `/api/documents?profileId=${encodeURIComponent(activeProfileId)}&take=20` : null;
  const {
    data: docsPages,
    isLoading: docsLoading,
    mutate: mutateDocs,
    size: docsSize,
    setSize: setDocsSize,
  } = useSWRInfinite<DocumentsPage>(
    (pageIndex, previousPageData) => {
      if (!docsApiUrl) return null;
      if (pageIndex === 0) return docsApiUrl;
      if (!previousPageData?.hasMore || !previousPageData?.nextCursor) return null;
      return `${docsApiUrl}&cursor=${encodeURIComponent(previousPageData.nextCursor)}`;
    },
    documentsFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 8_000,
      keepPreviousData: true,
    },
  );
  const docRows = useMemo(
    () => (docsPages ? docsPages.flatMap((p) => (Array.isArray(p.documents) ? p.documents : [])) : null),
    [docsPages],
  );
  const docsHasMore = docsPages ? Boolean(docsPages[docsPages.length - 1]?.hasMore) : false;
  const docsLoadingMore = docsLoading || (docsSize > 0 && !docsPages?.[docsSize - 1]);

  const activeDob = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.id === activeProfileId)?.dateOfBirth ?? null;
  }, [profiles, activeProfileId]);

  const ageMonths = useMemo(() => ageInMonthsFromDob(activeDob), [activeDob]);

  /** Семья — полные права; гостевой профиль — по sharedCanWrite. */
  const activeProfileCanWrite = useMemo(() => {
    if (!activeProfileId) return true;
    const p = profiles.find((x) => x.id === activeProfileId);
    if (!p?.isSharedGuest) return true;
    return p.sharedCanWrite !== false;
  }, [profiles, activeProfileId]);

  useEffect(() => {
    if (!activeProfileId) return;
    const refresh = () => setAutoRefreshTick((v) => v + 1);
    const intervalId = window.setInterval(refresh, 12_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [activeProfileId]);

  useEffect(() => {
    if (!activeProfileId) {
      setRows(null);
      lastLabPidRef.current = null;
      return;
    }
    const pidChanged = lastLabPidRef.current !== activeProfileId;
    lastLabPidRef.current = activeProfileId;
    if (pidChanged) {
      setRows(null);
    }

    const reqId = ++labReqIdRef.current;
    const hadRows = !pidChanged && rowsRef.current !== null;
    if (!hadRows) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    void listLabAnalysesForProfile(activeProfileId)
      .then((d) => {
        if (reqId !== labReqIdRef.current) return;
        if (!d.ok) {
          throw new Error(d.error);
        }
        startTransition(() => {
          setRows(d.analyses);
          setLastSyncedAt(Date.now());
        });
      })
      .catch((e: unknown) => {
        if (reqId !== labReqIdRef.current) return;
        setError(e instanceof Error ? e.message : t(lang, "analyses.errorLoad"));
        setRows(null);
      })
      .finally(() => {
        if (reqId === labReqIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      });
  }, [activeProfileId, refreshKey, autoRefreshTick, manualSyncTick, lang]);

  useEffect(() => {
    if (!docsApiUrl) return;
    void mutateDocs();
  }, [docsApiUrl, refreshKey, autoRefreshTick, manualSyncTick, mutateDocs]);

  useEffect(() => {
    if (!docsLoading && docsPages) {
      setLastSyncedAt(Date.now());
    }
  }, [docsLoading, docsPages]);

  useEffect(() => {
    setStatusFilter("all");
  }, [activeProfileId, refreshKey]);

  const listSourceRows = useMemo(() => {
    if (!rows?.length) return rows;
    if (!isTrends) return rows;
    if (trendsRangeDays == null) return rows;
    const cutoff = Date.now() - trendsRangeDays * 86400000;
    return rows.filter((r) => effectiveAnalysisTimeMs(r) >= cutoff);
  }, [rows, isTrends, trendsRangeDays]);

  const dynamicsKeys = useMemo(
    () => (listSourceRows?.length ? listBiomarkersWithDynamics(listSourceRows, 2) : []),
    [listSourceRows],
  );

  useEffect(() => {
    if (trendsFocusKey && !dynamicsKeys.includes(trendsFocusKey)) {
      setTrendsFocusKey(null);
    }
  }, [dynamicsKeys, trendsFocusKey]);

  const dynamicsKeysFiltered = useMemo(() => {
    if (!trendsFocusKey || !dynamicsKeys.includes(trendsFocusKey)) return dynamicsKeys;
    return [trendsFocusKey];
  }, [dynamicsKeys, trendsFocusKey]);

  const filteredRows = useMemo(() => {
    if (!listSourceRows?.length) return listSourceRows;
    if (!activeProfileId || compact || statusFilter === "all" || isTrends || archiveNeutral) {
      return listSourceRows;
    }
    return listSourceRows.filter((a) => analysisWorstStatus(a.data, activeDob) === statusFilter);
  }, [listSourceRows, activeProfileId, compact, statusFilter, activeDob, isTrends, archiveNeutral]);

  const unifiedForUi = useMemo((): UnifiedItem[] | null => {
    if (isTrends) return null;
    const labs = filteredRows ?? [];
    const docs = docRows ?? [];
    const items: UnifiedItem[] = [
      ...labs.map((lab) => ({
        kind: "lab" as const,
        sortMs: effectiveAnalysisTimeMs(lab),
        lab,
      })),
      ...docs.map((doc) => ({
        kind: "doc" as const,
        sortMs: doc.documentDate ? Date.parse(doc.documentDate) : Date.parse(doc.createdAt),
        doc,
      })),
    ];
    items.sort((a, b) => b.sortMs - a.sortMs);
    return compact ? items.slice(0, 2) : items;
  }, [filteredRows, docRows, isTrends, compact]);

  /** Полный скелетон только при первом получении данных, не при фоновом обновлении после загрузки файла. */
  const showBlockingSkeleton = (rows === null && loading) || (!isTrends && docRows === null && docsLoading);

  const listIdle = !loading && (isTrends || !docsLoading);
  const archiveTotalCount =
    (listSourceRows?.length ?? 0) + (isTrends ? 0 : (docRows?.length ?? 0));

  const filterKeys = [
    { id: "all" as const, label: t(lang, "analyses.filterAll") },
    { id: "critical" as const, label: t(lang, "analyses.filterCritical") },
    { id: "warning" as const, label: t(lang, "analyses.filterWarning") },
    { id: "normal" as const, label: t(lang, "analyses.filterNormal") },
  ];

  const trendDeltaInsight = (series: { value: number }[]) => {
    if (series.length < 2) return t(lang, "dynamics.insightStable");
    const a = series[series.length - 2]?.value;
    const b = series[series.length - 1]?.value;
    if (typeof a !== "number" || typeof b !== "number") return t(lang, "dynamics.insightStable");
    if (a === 0) return t(lang, "dynamics.insightStable");
    const pct = ((b - a) / Math.abs(a)) * 100;
    if (Math.abs(pct) < 2) return t(lang, "dynamics.insightStable");
    if (b > a) return t(lang, "dynamics.insightRising");
    return t(lang, "dynamics.insightFalling");
  };

  const syncedLabel = (() => {
    if (!lastSyncedAt) return null;
    const diffMs = Date.now() - lastSyncedAt;
    if (diffMs < 10_000) {
      return lang === "ru" ? "Синхронизировано только что" : "Азыр эле жаңыртылды";
    }
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) {
      return lang === "ru"
        ? `Синхронизировано ${sec} сек назад`
        : `${sec} сек мурун жаңыртылды`;
    }
    const min = Math.floor(sec / 60);
    if (min < 60) {
      return lang === "ru"
        ? `Синхронизировано ${min} мин назад`
        : `${min} мин мурун жаңыртылды`;
    }
    const h = Math.floor(min / 60);
    return lang === "ru"
      ? `Синхронизировано ${h} ч назад`
      : `${h} саат мурун жаңыртылды`;
  })();

  const startEditDoc = (d: HealthDocRow) => {
    setEditDocError(null);
    setEditingDoc({
      id: d.id,
      title: d.title,
      category: d.category || "OTHER",
      documentDate: d.documentDate ? d.documentDate.slice(0, 10) : "",
    });
  };

  const applyDocEditPatch = (docId: string, updater: (row: HealthDocRow) => HealthDocRow) => {
    void mutateDocs((prev) => {
      if (!prev) return prev;
      return prev.map((page) => ({
        ...page,
        documents: page.documents.map((row) => (row.id === docId ? updater(row) : row)),
      }));
    }, false);
  };

  const openDocumentWithSession = async (doc: HealthDocRow) => {
    setError(null);
    setOpenDocBusyId(doc.id);
    try {
      const isExternal =
        doc.fileUrl.startsWith("https://") || doc.fileUrl.startsWith("http://");

      if (isExternal) {
        // Vercel Blob or any external public URL — open directly.
        // In Telegram Mini App window.open is blocked, use openLink instead.
        type TgWebApp = { openLink?: (u: string, o?: { try_instant_view?: boolean }) => void };
        const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
        if (typeof tg?.openLink === "function") {
          tg.openLink(doc.fileUrl, { try_instant_view: false });
        } else {
          window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
        }
        return;
      }

      // Internal API URL (/api/documents/:id/file) — needs session cookie.
      const res = await fetch(doc.fileUrl, { credentials: "include" });
      if (res.status === 401) {
        setError("Сессия истекла. Войдите заново и повторите открытие документа.");
        return;
      }
      if (!res.ok) {
        setError("Не удалось открыть документ. Попробуйте ещё раз.");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const mimeFromHeader = res.headers.get("content-type")?.split(";")[0]?.trim();
      const mimeType =
        mimeFromHeader || doc.mimeType?.trim() || blob.type || "application/pdf";

      if (isTelegramMiniApp()) {
        setDocumentPreview({
          title: doc.title?.trim() || "Документ",
          blobUrl,
          mimeType,
        });
        return;
      }

      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      setError("Ошибка сети при открытии документа.");
    } finally {
      setOpenDocBusyId(null);
    }
  };

  const clearDocLongPressTimer = useCallback(() => {
    const r = docLongPressRef.current;
    if (r.timer) {
      clearTimeout(r.timer);
      r.timer = null;
    }
  }, []);

  const onDocRowPointerDown = (e: React.PointerEvent, d: HealthDocRow) => {
    if (e.button !== 0) return;
    clearDocLongPressTimer();
    docLongPressRef.current.startX = e.clientX;
    docLongPressRef.current.startY = e.clientY;
    docLongPressRef.current.fired = false;
    docLongPressRef.current.timer = setTimeout(() => {
      docLongPressRef.current.timer = null;
      docLongPressRef.current.fired = true;
      setDocActionMenu({
        doc: d,
        phase: "actions",
        anchorX: docLongPressRef.current.startX,
        anchorY: docLongPressRef.current.startY,
      });
    }, 480);
  };

  const onDocRowPointerMove = (e: React.PointerEvent) => {
    const r = docLongPressRef.current;
    if (!r.timer) return;
    if (Math.hypot(e.clientX - r.startX, e.clientY - r.startY) > 14) {
      clearDocLongPressTimer();
    }
  };

  const onDocRowPointerEnd = () => {
    clearDocLongPressTimer();
  };

  const onDocRowClick = (e: React.MouseEvent, d: HealthDocRow) => {
    if (docLongPressRef.current.fired) {
      docLongPressRef.current.fired = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    void openDocumentWithSession(d);
  };

  const openDocRowContextMenu = (e: React.MouseEvent, d: HealthDocRow) => {
    e.preventDefault();
    setDocActionMenu({
      doc: d,
      phase: "actions",
      anchorX: e.clientX,
      anchorY: e.clientY,
    });
  };

  const runDocTranslation = useCallback(async (d: HealthDocRow, targetLang: DocTranslateLang) => {
    setDocActionMenu(null);
    setDocTranslation({
      docId: d.id,
      title: d.title,
      targetLang,
      langLabel: DOC_TRANSLATE_LANG_LABEL[targetLang],
      text: "",
      loading: true,
      error: null,
    });
    const result = await postDocumentTranslate(d.id, targetLang);
    if (!result.ok) {
      setDocTranslation((prev) =>
        prev ? { ...prev, loading: false, error: result.error } : null,
      );
      return;
    }
    setDocTranslation((prev) =>
      prev
        ? {
            ...prev,
            loading: false,
            text: result.text,
            error: null,
          }
        : null,
    );
  }, []);

  const shareDocTranslation = useCallback(async () => {
    if (!docTranslation?.text) return;
    const title = `${docTranslation.title} (${docTranslation.langLabel})`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text: docTranslation.text });
        setShareToast(null);
      } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(docTranslation.text);
        setShareToast("Текст скопирован в буфер");
        window.setTimeout(() => setShareToast(null), 2500);
      }
    } catch {
      setShareToast("Не удалось поделиться");
      window.setTimeout(() => setShareToast(null), 2500);
    }
  }, [docTranslation]);

  useLayoutEffect(() => {
    if (!docActionMenu) return;
    const apply = () => {
      const pad = 10;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const el = docMenuPanelRef.current;
      const w = Math.max(el?.offsetWidth ?? 300, 120);
      const h = Math.max(el?.offsetHeight ?? 220, 100);
      let left = docActionMenu.anchorX - w / 2;
      let top = docActionMenu.anchorY + 12;
      left = Math.max(pad, Math.min(left, vw - w - pad));
      top = Math.max(pad, Math.min(top, vh - h - pad));
      setDocMenuFixedPos({ left, top });
    };
    apply();
    const id = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(id);
  }, [docActionMenu]);

  useEffect(() => {
    if (!docActionMenu && !docTranslation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (docTranslation) setDocTranslation(null);
      else setDocActionMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [docActionMenu, docTranslation]);

  if (!activeProfileId) return null;

  return (
    <section
      className={cn(
        "transition-shadow duration-300",
        isTrends && !compact
          ? "space-y-4 bg-transparent p-0 shadow-none ring-0"
          : "rounded-2xl bg-health-surface shadow-md shadow-slate-900/[0.06] ring-1 ring-health-border/80 backdrop-blur-sm",
        compact ? "flex h-full min-h-0 flex-col overflow-hidden p-2" : !isTrends && "p-4 sm:p-5",
      )}
    >
      {!hideHeader ? (
        <>
          <div className="flex items-center gap-2">
            <h2
              className={cn(
                "font-manrope font-semibold text-health-text",
                compact ? "text-xs" : "text-h3",
              )}
            >
              {isTrends ? t(lang, "trends.pageTitle") : t(lang, "analyses.title")}
            </h2>
            {refreshing ? (
              <Loader2
                className={cn("shrink-0 animate-spin text-health-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")}
                aria-hidden
              />
            ) : null}
          </div>
          {!compact ? (
            isTrends ? (
              <p className="mt-1 text-body text-health-text-secondary">{t(lang, "trends.pageSubtitle")}</p>
            ) : archiveNeutral ? (
              <p className="mt-1 text-body text-health-text-secondary">{t(lang, "analyses.archiveSubtitle")}</p>
            ) : (
              <>
                <p className="mt-1 text-body text-health-text-secondary">{t(lang, "analyses.subtitle")}</p>
                <p className="mt-1 text-caption leading-relaxed text-health-text-secondary/90">
                  {t(lang, "analyses.labsBrands")}
                </p>
              </>
            )
          ) : (
            <p className="mt-0.5 truncate text-[10px] text-health-text-secondary">
              {archiveNeutral && !isTrends ? t(lang, "analyses.archiveSubtitle") : t(lang, "analyses.subtitle")}
            </p>
          )}
        </>
      ) : null}

      {!isTrends || (showDoctorReportPdf && activeProfileId) ? (
        <div className={cn("flex flex-wrap items-center gap-2", hideHeader ? "mt-0.5" : "mt-1")}>
          {!isTrends ? (
            <>
              {syncedLabel ? (
                <p className="text-[10px] text-health-text-secondary">{syncedLabel}</p>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100/90 px-2 py-1 text-[10px] font-semibold text-health-primary ring-1 ring-health-border/70 hover:bg-slate-50"
                onClick={() => setManualSyncTick((n) => n + 1)}
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                {t(lang, "analyses.refreshSync")}
              </button>
            </>
          ) : null}
          {showDoctorReportPdf && activeProfileId ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-teal-50/90 px-2 py-1 text-[10px] font-semibold text-teal-800 ring-1 ring-teal-200/80 hover:bg-teal-50 disabled:opacity-60"
              disabled={doctorReportBusy}
              onClick={() => {
                if (doctorReportBusy) return;
                void (async () => {
                  setDoctorReportBusy(true);
                  try {
                    await downloadDoctorReportPdf(activeProfileId);
                  } finally {
                    setDoctorReportBusy(false);
                  }
                })();
              }}
            >
              {doctorReportBusy ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
              ) : (
                <FileDown className="h-3 w-3 shrink-0" aria-hidden />
              )}
              {t(lang, "profile.medicalReportPdf")}
            </button>
          ) : null}
        </div>
      ) : null}
      {!isTrends && !activeProfileCanWrite ? (
        <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-health-text-secondary ring-1 ring-slate-200/80">
          {t(lang, "analyses.readOnlyArchive")}
        </p>
      ) : null}

      {isTrends && !compact ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-md shadow-slate-900/[0.04] ring-1 ring-health-border/80">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                { days: null as number | null, key: "all" },
                { days: 90, key: "3m" },
                { days: 180, key: "6m" },
                { days: 365, key: "1y" },
              ] as const
            ).map(({ days, key }) => {
              const active =
                (days === null && trendsRangeDays === null) ||
                (days !== null && trendsRangeDays === days);
              const label =
                key === "all"
                  ? t(lang, "dynamics.rangeAll")
                  : key === "3m"
                    ? t(lang, "dynamics.range3m")
                    : key === "6m"
                      ? t(lang, "dynamics.range6m")
                      : t(lang, "dynamics.range1y");
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTrendsRangeDays(days)}
                  className={cn(
                    "min-h-[36px] shrink-0 rounded-lg px-3 text-[12px] font-semibold transition-colors",
                    active
                      ? "bg-teal-50 text-health-primary shadow-sm ring-1 ring-teal-200"
                      : "bg-slate-50 text-health-text-secondary hover:bg-slate-100",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {dynamicsKeys.length > 0 ? (
            <label className="flex flex-col gap-1 text-caption font-medium text-health-text-secondary">
              <span>{t(lang, "dynamics.selectMetric")}</span>
              <select
                value={trendsFocusKey ?? ""}
                onChange={(e) => setTrendsFocusKey(e.target.value === "" ? null : e.target.value)}
                className="min-h-[44px] rounded-xl border-0 bg-slate-50 px-3 text-body text-health-text shadow-sm ring-1 ring-health-border/80"
              >
                <option value="">{t(lang, "dynamics.metricAll")}</option>
                {dynamicsKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {!archiveNeutral && !isTrends && !compact && rows && rows.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {filterKeys.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-caption font-semibold transition-all duration-300",
                statusFilter === id
                  ? "bg-health-primary text-white shadow-sm"
                  : "bg-slate-100 text-health-text-secondary hover:bg-slate-200/90",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {showBlockingSkeleton ? (
        <AnalysisSkeleton className={compact ? "mt-2" : "mt-3"} />
      ) : !isTrends && docsLoading && docRows !== null && docRows.length > 0 ? (
        <div className={cn("space-y-2", compact ? "mt-2" : "mt-3")}>
          {[1, 2, 3].map((i) => (
            <DocumentSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <p className={cn("text-health-danger", compact ? "mt-2 text-xs" : "mt-3 text-sm")}>{error}</p>
      ) : listIdle &&
        (isTrends
          ? (rows?.length ?? 0) === 0
          : (rows?.length ?? 0) === 0 && docRows !== null && docRows.length === 0) ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center text-center",
            compact ? "mt-2 px-2 py-4" : "mt-6 px-4 py-10",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-100/80 shadow-inner ring-1 ring-teal-100/80",
              compact ? "h-10 w-10" : "h-16 w-16",
            )}
          >
            <Stethoscope
              className="text-health-primary/70"
              size={compact ? 22 : 36}
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
          <h3
            className={cn(
              "font-manrope font-semibold text-health-text",
              compact ? "mt-2 text-xs" : "mt-4 text-base",
            )}
          >
            {t(lang, "analyses.emptyPrimary")}
          </h3>
          <p
            className={cn(
              "text-health-text-secondary",
              compact ? "mt-1 max-w-xs text-[10px]" : "mt-2 max-w-sm text-body",
            )}
          >
            {t(lang, "analyses.emptySecondary")}
          </p>
          {onRequestUpload ? (
            <button
              type="button"
              onClick={onRequestUpload}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl bg-health-primary font-semibold text-white shadow-md shadow-teal-900/15 transition-all duration-300 hover:bg-teal-700",
                compact ? "mt-2 px-3 py-1.5 text-[11px]" : "mt-5 px-6 py-3 text-sm",
              )}
            >
              <PlusCircle size={compact ? 14 : 16} strokeWidth={2} aria-hidden />
              {t(lang, "tests.uploadBig")}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {!compact && isTrends && listSourceRows && listSourceRows.length > 0 ? (
            <div className="mt-4">
              <AnalysisComparePanel
                analyses={listSourceRows}
                activeDob={activeDob}
                refreshKey={refreshKey}
              />
            </div>
          ) : null}
          {!isTrends &&
          unifiedForUi &&
          unifiedForUi.length === 0 &&
          (listSourceRows?.length ?? 0) > 0 &&
          statusFilter !== "all" ? (
            <div
              className={cn(
                "rounded-xl bg-slate-50/90 text-center text-health-text-secondary ring-1 ring-health-border/70",
                compact ? "mt-2 px-3 py-6 text-xs" : "mt-4 px-4 py-10 text-body",
              )}
            >
              {t(lang, "analyses.filterEmpty")}
            </div>
          ) : null}
          {!isTrends && unifiedForUi && unifiedForUi.length > 0 ? (
            <>
            <ul
              className={cn(
                "grid gap-2",
                compact
                  ? "mt-2 min-h-0 flex-1 grid-cols-1 overflow-hidden"
                  : "mt-4 grid-cols-1 gap-3 sm:grid-cols-2",
              )}
            >
          {unifiedForUi.map((item, idx) => {
            if (item.kind === "doc") {
              const d = item.doc;
              const loc = lang === "ru" ? "ru-RU" : "ky-KG";
              const { primary, hint } = archivePrimaryDateLabel(d.documentDate, d.createdAt, loc);
              return (
                <motion.li
                  key={`doc-${d.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: idx * 0.05, ease: "easeOut" }}
                  className={cn(
                    "rounded-2xl bg-white text-health-text shadow-sm ring-1 ring-slate-200/90 transition-all duration-300 hover:shadow-lg",
                    compact ? "px-2.5 py-2 text-xs" : "px-4 py-3 text-sm",
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full min-h-[3rem] touch-manipulation select-none items-start gap-3 text-left [-webkit-touch-callout:none]"
                    onPointerDown={(e) => onDocRowPointerDown(e, d)}
                    onPointerMove={onDocRowPointerMove}
                    onPointerUp={onDocRowPointerEnd}
                    onPointerCancel={onDocRowPointerEnd}
                    onClick={(e) => onDocRowClick(e, d)}
                    onContextMenu={(e) => openDocRowContextMenu(e, d)}
                    disabled={openDocBusyId === d.id}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-health-primary">
                      {openDocBusyId === d.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      ) : (
                        <FileText className="h-5 w-5" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-health-text">{d.title}</span>
                      <span className="mt-1 block text-xs text-health-text-secondary">
                        {primary}
                        {hint ? (
                          <span className="mt-0.5 block text-[11px] text-health-text-secondary/85">
                            {hint}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </motion.li>
              );
            }

            const a = item.lab;
            const n = biomarkerCount(a.data);
            const worst = analysisWorstStatus(a.data, activeDob);
            const open = !compact && expandedId === a.id;
            const payload =
              a.data && typeof a.data === "object"
                ? (a.data as HealthRecordAnalysisPayload)
                : null;

            return (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: idx * 0.05, ease: "easeOut" }}
                className={cn(
                  "rounded-2xl text-health-text transition-all duration-300 hover:shadow-lg",
                  compact ? "px-2.5 py-2 text-xs" : "px-4 py-3 text-sm",
                  archiveNeutral && !isTrends
                    ? "bg-white shadow-sm ring-1 ring-slate-200/90"
                    : cardTone(worst),
                )}
              >
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 min-h-[3rem] flex-1 items-start justify-between gap-2 text-left"
                    onClick={() => {
                      if (compact && onOpenAnalyses) {
                        onOpenAnalyses();
                        return;
                      }
                      setExpandedId(open ? null : a.id);
                    }}
                    aria-expanded={open}
                  >
                    <span>
                      <span
                        className="font-semibold text-health-text"
                        style={
                          archiveNeutral && !isTrends
                            ? undefined
                            : { borderBottom: `2px solid ${getStatusColorHex(worst)}` }
                        }
                      >
                        {a.title ?? t(lang, "analyses.analysis")}
                      </span>
                      {n != null ? (
                        <span className="ml-2 text-xs text-health-text-secondary">
                          {n} {t(lang, "analyses.indicators")}
                        </span>
                      ) : null}
                      {a.isPrivate ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-950 ring-1 ring-amber-200/70">
                          {t(lang, "analyses.private")}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-health-text-secondary">
                        {new Date(effectiveAnalysisTimeMs(a)).toLocaleDateString(
                          lang === "ru" ? "ru-RU" : "ky-KG",
                        )}
                        {archiveNeutral && !isTrends && payload ? (
                          <span className="mt-0.5 block text-[11px] text-health-text-secondary/90">
                            {(labNameFromRow(a.data) ?? "—") + " · " + fileTypeLabel(payload.mimeType)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {!compact ? (
                      open ? (
                        <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-health-primary" />
                      ) : (
                        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-health-primary" />
                      )
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={deleteBusyId === a.id}
                    title={t(lang, "analyses.delete")}
                    aria-label={t(lang, "analyses.delete")}
                    className={cn(
                      "flex min-w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-red-50/90 px-2 py-1.5 text-red-800 ring-1 ring-red-200/80 shadow-sm transition-colors hover:bg-red-100/90 disabled:opacity-50 sm:min-w-[4.5rem] sm:flex-row sm:gap-1 sm:px-2.5",
                      compact && "min-w-10 px-1.5 py-1",
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!window.confirm(t(lang, "analyses.deleteConfirm"))) return;
                      setDeleteBusyId(a.id);
                      void deleteLabAnalysis(a.id)
                        .then((r) => {
                          if (!r.ok) {
                            setError(r.error);
                            return;
                          }
                          setRows((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
                          setExpandedId((ex) => (ex === a.id ? null : ex));
                          setActiveShare((s) => (s?.recordId === a.id ? null : s));
                        })
                        .finally(() => setDeleteBusyId(null));
                    }}
                  >
                    {deleteBusyId === a.id ? (
                      <Loader2 className={cn("animate-spin", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                    ) : (
                      <Trash2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
                    )}
                    <span
                      className={cn(
                        "max-w-[3.5rem] text-center text-[9px] font-bold uppercase leading-tight text-red-800 sm:max-w-none sm:text-[10px]",
                        compact && "sr-only",
                      )}
                    >
                      {t(lang, "analyses.delete")}
                    </span>
                  </button>
                </div>

                {open ? (
                  <div className="mt-2 border-t border-health-border/60 pt-3">
                    {payload?.biomarkers && payload.biomarkers.length > 0 ? (
                      archiveNeutral || isTrends ? (
                        <>
                          <p className="mb-2 text-[11px] font-semibold text-slate-800">
                            {lang === "ru" ? "Показатели" : "Көрсөткүчтөр"} · {payload.biomarkers.length}
                          </p>
                          <ul className="max-h-[min(60vh,28rem)] space-y-1 overflow-y-auto pr-0.5">
                            {[...payload.biomarkers]
                              .sort((x, y) =>
                                x.biomarker.localeCompare(y.biomarker, lang === "ru" ? "ru" : "ky"),
                              )
                              .map((b: ParsedBiomarker, idx: number) => {
                                const nk = normalizeBiomarkerKey(b.biomarker);
                                const catId = nk ? categoryForBiomarkerKey(nk) : "other";
                                return (
                                  <li
                                    key={`${a.id}-${idx}-${b.biomarker}`}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/90 px-2 py-1.5 text-xs ring-1 ring-slate-200/80"
                                  >
                                    <span className="min-w-0 text-slate-700">
                                      <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                        {t(lang, `category.${catId}`)}
                                      </span>
                                      <span className="font-medium text-slate-900">
                                        {b.biomarker}:{" "}
                                        <strong className="text-slate-900">
                                          {b.value} {b.unit}
                                        </strong>
                                      </span>
                                    </span>
                                  </li>
                                );
                              })}
                          </ul>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const ranked = [...payload.biomarkers].sort((x, y) => {
                              const rank: Record<MedicalStatus, number> = {
                                critical: 0,
                                warning: 1,
                                normal: 2,
                              };
                              return (
                                rank[statusForBiomarker(x, activeDob)] -
                                rank[statusForBiomarker(y, activeDob)]
                              );
                            });
                            const critical = ranked.filter(
                              (b) => statusForBiomarker(b, activeDob) === "critical",
                            );
                            const warning = ranked.filter(
                              (b) => statusForBiomarker(b, activeDob) === "warning",
                            );
                            const normal = ranked.filter(
                              (b) => statusForBiomarker(b, activeDob) === "normal",
                            );

                            return (
                              <>
                                <p className="mb-2 text-[11px] font-semibold text-slate-800">
                                  Все показатели · {ranked.length}{" "}
                                  <span className="font-normal text-slate-500">
                                    (сначала отклонения от нормы)
                                  </span>
                                </p>
                                <ul className="max-h-[min(60vh,28rem)] space-y-1 overflow-y-auto pr-0.5">
                                  {ranked.map((b: ParsedBiomarker, idx: number) => {
                                    const st = statusForBiomarker(b, activeDob);
                                    const nk = normalizeBiomarkerKey(b.biomarker);
                                    const catId = nk ? categoryForBiomarkerKey(nk) : "other";
                                    return (
                                      <li
                                        key={`${a.id}-${idx}-${b.biomarker}`}
                                        className={cn(
                                          "flex items-center justify-between gap-2 rounded-lg border-l-4 px-2 py-1.5 text-xs",
                                          st === "critical" && "border-l-red-500 bg-[#fff4f4]",
                                          st === "warning" && "border-l-amber-500 bg-amber-50/80",
                                          st === "normal" && "border-l-emerald-200 bg-white/60",
                                        )}
                                      >
                                        <span className="min-w-0 text-slate-700">
                                          <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                            {t(lang, `category.${catId}`)}
                                          </span>
                                          <span className="font-medium text-slate-900">
                                            {b.biomarker}:{" "}
                                            <strong
                                              className={cn(
                                                st === "critical" && "text-red-800",
                                                st === "warning" && "text-amber-900",
                                                st === "normal" && "text-slate-900",
                                              )}
                                            >
                                              {b.value} {b.unit}
                                            </strong>
                                          </span>
                                        </span>
                                        <span
                                          className={cn(
                                            "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                            statusIndicatorPillClass(st),
                                          )}
                                        >
                                          {t(lang, `status.${st}`)}
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>

                                <div
                                  className={cn(
                                    "mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed",
                                    critical.length > 0
                                      ? "bg-red-50/90 text-red-900 ring-1 ring-red-200/80"
                                      : warning.length > 0
                                        ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200/70"
                                        : "bg-emerald-50/70 text-emerald-900 ring-1 ring-emerald-200/60",
                                  )}
                                >
                                  <p className="font-semibold">
                                    {critical.length > 0
                                      ? "🔴 Критические отклонения"
                                      : warning.length > 0
                                        ? "🟡 Незначительные отклонения"
                                        : "🟢 Все показатели в норме"}
                                  </p>
                                  <p className="mt-1 text-[11px] opacity-85">
                                    {critical.length > 0
                                      ? `${critical.map((b) => b.biomarker).join(", ")} — значительно выходит за пределы нормы. Рекомендуем обратиться к врачу.`
                                      : warning.length > 0
                                        ? `${warning.map((b) => b.biomarker).join(", ")} — на границе нормы. Рекомендуем повторный анализ через 1–2 месяца.`
                                        : `${normal.length} показателей в пределах нормы. Продолжайте мониторинг.`}
                                  </p>
                                  <p className="mt-1.5 text-[10px] opacity-60">
                                    Не является медицинским диагнозом. Консультируйтесь с врачом.
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </>
                      )
                    ) : (
                      <p className="py-2 text-xs text-slate-500">
                        Показатели в этой записи не найдены или ещё обрабатываются.
                      </p>
                    )}

                    <div
                      className={cn(
                        "mt-3 flex flex-wrap gap-2",
                        !compact && "pb-[max(5.5rem,env(safe-area-inset-bottom,0px))] sm:pb-2",
                      )}
                    >
                      <button
                        type="button"
                        className="rounded-lg bg-health-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
                        onClick={async () => {
                          const res = await createShareToken(a.id);
                          if (!res.ok) return;
                          const url = `${window.location.origin}/share/${res.token}`;
                          setActiveShare({ recordId: a.id, url });
                        }}
                      >
                        {t(lang, "analyses.shareDoctor")}
                      </button>
                      <button
                        type="button"
                        disabled={pdfBusyId === a.id}
                        className="rounded-lg border border-health-border bg-health-surface px-3 py-1.5 text-xs font-medium text-health-text shadow-sm disabled:opacity-50"
                        onClick={() => {
                          setPdfError(null);
                          setPdfBusyId(a.id);
                          void downloadLabPdfClient(a.id)
                            .then((r) => {
                              if (!r.ok) setPdfError({ id: a.id, msg: r.error });
                            })
                            .finally(() => setPdfBusyId(null));
                        }}
                      >
                        {pdfBusyId === a.id ? "…" : t(lang, "analyses.downloadPdf")}
                      </button>
                    </div>

                    {!compact && activeProfileCanWrite ? (
                      <button
                        type="button"
                        disabled={deleteBusyId === a.id}
                        className="mt-3 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-sm font-semibold text-red-900 ring-1 ring-red-200/80 shadow-sm transition-colors hover:bg-red-100/90 disabled:opacity-50"
                        onClick={() => {
                          if (!window.confirm(t(lang, "analyses.deleteConfirm"))) return;
                          setDeleteBusyId(a.id);
                          void deleteLabAnalysis(a.id)
                            .then((r) => {
                              if (!r.ok) {
                                setError(r.error);
                                return;
                              }
                              setRows((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
                              setExpandedId((ex) => (ex === a.id ? null : ex));
                              setActiveShare((s) => (s?.recordId === a.id ? null : s));
                            })
                            .finally(() => setDeleteBusyId(null));
                        }}
                      >
                        {deleteBusyId === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                        )}
                        {t(lang, "analyses.delete")}
                      </button>
                    ) : null}

                    {pdfError?.id === a.id ? (
                      <p className="mt-2 text-xs text-red-700">{pdfError.msg}</p>
                    ) : null}
                    {activeShare?.recordId === a.id ? (
                      <div className="mt-3 rounded-xl bg-health-surface p-3 ring-1 ring-health-border/80">
                        <p className="text-xs font-semibold text-health-text">{t(lang, "analyses.qrTitle")}</p>
                        <p className="text-[11px] text-health-text-secondary">{t(lang, "analyses.qrHint")}</p>
                        <div className="mt-2 flex justify-center rounded-lg bg-white p-2">
                          <QRCodeSVG value={activeShare.url} size={168} level="M" includeMargin />
                        </div>
                        <a
                          className="mt-2 block break-all text-xs font-medium text-health-primary underline decoration-teal-200 underline-offset-2"
                          href={activeShare.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {activeShare.url}
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </motion.li>
            );
          })}
            </ul>
            {!compact && docsHasMore ? (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => void setDocsSize((s) => s + 1)}
                  disabled={docsLoadingMore}
                  className="rounded-xl border border-health-border bg-white px-4 py-2 text-sm font-semibold text-health-text shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {docsLoadingMore ? "Загрузка..." : "Загрузить еще"}
                </button>
              </div>
            ) : null}
            </>
          ) : null}
        </>
      )}

      {compact && archiveTotalCount > 2 && onOpenAnalyses ? (
        <button
          type="button"
          onClick={onOpenAnalyses}
          className="mt-1.5 shrink-0 rounded-xl bg-teal-50 py-2 text-center text-caption font-semibold text-health-primary ring-1 ring-teal-100 transition-colors hover:bg-teal-100/80"
        >
          {t(lang, "analyses.viewAll")}
          <span className="text-health-text-secondary"> · +{archiveTotalCount - 2}</span>
        </button>
      ) : null}

      {!compact &&
      isTrends &&
      listSourceRows &&
      listSourceRows.length >= 2 &&
      dynamicsKeysFiltered.length > 0 ? (
        <div className="mt-6 space-y-4 border-t border-health-border/60 pt-4">
          <h3 className="text-caption font-semibold uppercase tracking-wider text-health-text-secondary">
            {t(lang, "analyses.dynamics")}
          </h3>
          <div className="flex flex-col gap-4">
            {dynamicsKeysFiltered.map((key) => {
              const series = buildBiomarkerSeries(listSourceRows, key, activeDob);
              if (series.length < 2) return null;
              const norm = getNormForBiomarker(key, ageMonths);
              const unit = unitForBiomarkerKey(listSourceRows, key);
              const insight = trendDeltaInsight(series);

              return (
                <div key={key} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
                  <BiomarkerChart
                    title={key}
                    unit={unit}
                    data={series}
                    normMin={norm?.min ?? null}
                    normMax={norm?.max ?? null}
                  />
                  <p className="text-xs font-medium text-slate-600">
                    <span className="text-health-text-secondary">{t(lang, "dynamics.selectMetric")}: </span>
                    {insight}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!compact ? (
        <p className="mt-4 text-[10px] leading-tight text-health-text-secondary">{t(lang, "analyses.disclaimer")}</p>
      ) : null}

      {documentPreview ? (
        <div
          className="fixed inset-0 z-[195] flex flex-col bg-[#0f1419] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label={documentPreview.title}
        >
          <header
            className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#004253] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white"
          >
            <button
              type="button"
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold transition hover:bg-white/25 active:scale-[0.98]"
              onClick={closeDocumentPreview}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Назад
            </button>
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{documentPreview.title}</p>
          </header>
          <p className="shrink-0 bg-[#0f1419] px-3 py-1.5 text-center text-[11px] text-white/55">
            Двойной тап по документу — увеличить; ещё раз — по размеру экрана
          </p>
          <div
            className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-black pb-[max(0.5rem,env(safe-area-inset-bottom))] selection:bg-teal-500/30"
            style={{ touchAction: "manipulation" }}
            onTouchStart={registerDocPreviewTouchStart}
            onTouchEnd={onDocPreviewContentTouchEnd}
            onDoubleClick={onDocPreviewContentDoubleClick}
          >
            {documentPreview.mimeType.startsWith("image/") ? (
              <div className="flex min-h-full min-w-full items-center justify-center p-2">
                <img
                  src={documentPreview.blobUrl}
                  alt=""
                  className={cn(
                    docPreviewMagnified
                      ? "h-auto max-h-none w-auto min-w-full max-w-[220%] object-contain"
                      : "max-h-full max-w-full object-contain",
                  )}
                  draggable={false}
                />
              </div>
            ) : (
              <iframe
                title={documentPreview.title}
                src={documentPreview.blobUrl}
                className="box-border border-0 bg-white"
                style={
                  docPreviewMagnified
                    ? { width: "160%", height: "160%", minHeight: "100%" }
                    : { width: "100%", height: "100%", minHeight: "100%" }
                }
              />
            )}
          </div>
        </div>
      ) : null}

      {editingDoc ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center p-3 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Редактирование документа"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            disabled={editDocBusy}
            aria-label="Закрыть"
            onClick={() => {
              if (!editDocBusy) setEditingDoc(null);
            }}
          />
          <form
            className="relative z-10 w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingDoc) return;
              setEditDocBusy(true);
              setEditDocError(null);
              void updateHealthDocumentMeta({
                id: editingDoc.id,
                title: editingDoc.title,
                category: editingDoc.category,
                documentDate: editingDoc.documentDate || null,
              })
                .then((r) => {
                  if (!r.ok) {
                    setEditDocError(r.error);
                    return;
                  }
                  applyDocEditPatch(editingDoc.id, (row) => ({
                    ...row,
                    title: editingDoc.title.trim(),
                    category: editingDoc.category,
                    documentDate: editingDoc.documentDate || null,
                  }));
                  setEditingDoc(null);
                })
                .finally(() => setEditDocBusy(false));
            }}
          >
            <p className="mb-3 text-sm font-semibold text-health-text">Изменить документ</p>
            <input
              value={editingDoc.title}
              onChange={(e) =>
                setEditingDoc((prev) => (prev ? { ...prev, title: e.target.value } : prev))
              }
              placeholder="Название документа"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={editingDoc.category}
                onChange={(e) =>
                  setEditingDoc((prev) => (prev ? { ...prev, category: e.target.value } : prev))
                }
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
              >
                {Object.entries(ARCHIVE_CATEGORY_RU).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={editingDoc.documentDate}
                onChange={(e) =>
                  setEditingDoc((prev) => (prev ? { ...prev, documentDate: e.target.value } : prev))
                }
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
              />
            </div>
            {editDocError ? <p className="mt-2 text-xs text-red-700">{editDocError}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={editDocBusy}
                className="rounded-lg bg-health-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {editDocBusy ? "Сохранение..." : "Сохранить"}
              </button>
              <button
                type="button"
                disabled={editDocBusy}
                onClick={() => setEditingDoc(null)}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {docActionMenu && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[202] bg-black/45"
                aria-label="Закрыть"
                onClick={() => setDocActionMenu(null)}
              />
              <div
                ref={docMenuPanelRef}
                className="fixed z-[203] w-[min(calc(100vw-20px),20rem)] rounded-2xl bg-white p-1 shadow-2xl ring-1 ring-black/10"
                style={{ left: docMenuFixedPos.left, top: docMenuFixedPos.top }}
                role="dialog"
                aria-modal="true"
                aria-label="Действия с документом"
              >
            {docActionMenu.phase === "actions" ? (
              <div className="flex flex-col">
                <button
                  type="button"
                  className="min-h-12 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-health-text hover:bg-slate-50"
                  onClick={() => {
                    const doc = docActionMenu.doc;
                    setDocActionMenu(null);
                    closeDocumentPreview();
                    setAiDocModal({ id: doc.id, title: doc.title });
                  }}
                >
                  ИИ расшифровка
                </button>
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium text-health-text hover:bg-slate-50"
                  onClick={() => setDocActionMenu((m) => (m ? { ...m, phase: "language" } : null))}
                >
                  Язык
                  <span className="text-slate-400" aria-hidden>
                    ›
                  </span>
                </button>
                {activeProfileCanWrite ? (
                  <>
                    <button
                      type="button"
                      className="min-h-12 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-health-text hover:bg-slate-50"
                      onClick={() => {
                        startEditDoc(docActionMenu.doc);
                        setDocActionMenu(null);
                      }}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="min-h-12 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-red-700 hover:bg-red-50"
                      disabled={deleteDocBusyId === docActionMenu.doc.id}
                      onClick={() => {
                        if (!window.confirm(t(lang, "analyses.deleteDocConfirm"))) return;
                        const delId = docActionMenu.doc.id;
                        setDocActionMenu(null);
                        setDeleteDocBusyId(delId);
                        void deleteHealthDocument(delId)
                          .then((r) => {
                            if (!r.ok) {
                              setError(r.error);
                              return;
                            }
                            void mutateDocs((prev) => {
                              if (!prev) return prev;
                              return prev.map((page) => ({
                                ...page,
                                documents: page.documents.filter((x) => x.id !== delId),
                              }));
                            }, false);
                          })
                          .finally(() => setDeleteDocBusyId(null));
                      }}
                    >
                      {deleteDocBusyId === docActionMenu.doc.id ? "Удаление…" : "Удалить"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col">
                <button
                  type="button"
                  className="min-h-11 w-full rounded-xl px-4 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => setDocActionMenu((m) => (m ? { ...m, phase: "actions" } : null))}
                >
                  ‹ Назад
                </button>
                {(["ru", "en", "hi"] as const).map((lng) => (
                  <button
                    key={lng}
                    type="button"
                    className="min-h-12 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-health-text hover:bg-slate-50"
                    onClick={() => void runDocTranslation(docActionMenu.doc, lng)}
                  >
                    {DOC_TRANSLATE_LANG_LABEL[lng]}
                  </button>
                ))}
              </div>
            )}
              </div>
            </>,
            document.body,
          )
        : null}

      {docTranslation ? (
        <div
          className="fixed inset-0 z-[204] flex flex-col bg-[#0f1419]"
          role="dialog"
          aria-modal="true"
          aria-label="Перевод документа"
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#004253] px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25"
              onClick={() => setDocTranslation(null)}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Назад
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{docTranslation.title}</p>
              <p className="truncate text-[11px] text-white/75">{docTranslation.langLabel}</p>
            </div>
            <button
              type="button"
              disabled={docTranslation.loading || !docTranslation.text}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25 disabled:opacity-40"
              onClick={() => void shareDocTranslation()}
            >
              <Share2 className="h-4 w-4 shrink-0" aria-hidden />
              Поделиться
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {docTranslation.loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-health-text-secondary">
                <Loader2 className="h-8 w-8 animate-spin text-health-primary" aria-hidden />
                <p className="text-sm">Переводим документ…</p>
              </div>
            ) : docTranslation.error ? (
              <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">{docTranslation.error}</p>
            ) : (
              <article className="mx-auto max-w-3xl rounded-lg bg-white p-4 shadow-md ring-1 ring-slate-200/80 sm:p-6">
                <p className="mb-3 text-[11px] text-slate-500">
                  Текст извлечён из файла; перевод сохраняет абзацы. Для сканов возможны неточности OCR.
                </p>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-900">
                  {docTranslation.text}
                </pre>
              </article>
            )}
          </div>
        </div>
      ) : null}

      {shareToast ? (
        <div className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[210] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {shareToast}
        </div>
      ) : null}

      <DocumentAiAnalysisModal
        open={aiDocModal !== null}
        onClose={() => setAiDocModal(null)}
        documentId={aiDocModal?.id ?? null}
        documentTitle={aiDocModal?.title}
      />
    </section>
  );
}
