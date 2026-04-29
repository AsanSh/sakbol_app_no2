"use client";

import { saveBlobWithPickerOrDownload } from "@/lib/client/save-blob-as";
import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";

function triggerDoctorReportAnchor(profileId: string) {
  const a = document.createElement("a");
  a.href = `/api/profile/${encodeURIComponent(profileId)}/doctor-report/pdf`;
  a.download = `sakbol-vrachu-${formatClinicalAnonymId(profileId)}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function looksLikeTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp);
}

export async function downloadDoctorReportPdf(
  profileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  /** В WebView Telegram fetch→blob часто «висит»; нативный GET по ссылке с cookie обычно срабатывает. */
  if (looksLikeTelegramMiniApp()) {
    triggerDoctorReportAnchor(profileId);
    return { ok: true };
  }

  const timeoutMs = 90_000;
  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  let res: Response;
  try {
    res = await fetch(`/api/profile/${encodeURIComponent(profileId)}/doctor-report/pdf`, {
      credentials: "include",
      method: "GET",
      signal,
    });
  } catch (e) {
    const isAbort =
      e instanceof DOMException
        ? e.name === "AbortError" || e.name === "TimeoutError"
        : e instanceof Error && /abort|timeout/i.test(e.name);
    if (isAbort) {
      triggerDoctorReportAnchor(profileId);
      return { ok: true };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Сеть недоступна." };
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let message = res.statusText?.trim() || `Ошибка ${res.status}`;
    if (raw) {
      try {
        const j = JSON.parse(raw) as { error?: string };
        if (j.error) message = j.error;
      } catch {
        const t = raw.trim().slice(0, 240);
        if (t && !t.startsWith("<")) message = t;
      }
    }
    if (res.status === 401) {
      message =
        "Нужна сессия в этом браузере. Войдите на сайте (код из Telegram или email) или откройте мини-приложение.";
    }
    return { ok: false, error: message };
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/pdf")) {
    const raw = await res.text().catch(() => "");
    let message = "Сервер вернул не PDF.";
    if (raw) {
      try {
        const j = JSON.parse(raw) as { error?: string };
        if (j.error) message = j.error;
      } catch {
        message = raw.trim().slice(0, 200) || message;
      }
    }
    return { ok: false, error: message };
  }

  const buf = await res.arrayBuffer();
  const blob = new Blob([buf], { type: "application/pdf" });
  await saveBlobWithPickerOrDownload(blob, `sakbol-vrachu-${formatClinicalAnonymId(profileId)}.pdf`);

  return { ok: true };
}
