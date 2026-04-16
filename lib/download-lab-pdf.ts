/**
 * Скачивание PDF анализа в том же контексте, где есть httpOnly cookie.
 * Нельзя открывать /api/.../pdf через Telegram.openLink — внешний браузер без сессии → 401.
 */
function triggerPdfDownloadAnchor(recordId: string) {
  const a = document.createElement("a");
  a.href = `/api/analyses/${recordId}/pdf`;
  a.download = `sakbol-analysis-${recordId}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function looksLikeTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp);
}

export async function downloadLabPdfClient(recordId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  /** В WebView Telegram fetch→blob часто «висит»; нативный GET по ссылке с cookie обычно срабатывает. */
  if (looksLikeTelegramMiniApp()) {
    triggerPdfDownloadAnchor(recordId);
    return { ok: true };
  }

  const timeoutMs = 90_000;
  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  let res: Response;
  try {
    res = await fetch(`/api/analyses/${recordId}/pdf`, {
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
      triggerPdfDownloadAnchor(recordId);
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
        "Нужна сессия в этом браузере. Откройте сайт, войдите через Telegram (виджет на странице входа) или откройте мини-апп.";
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
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `sakbol-analysis-${recordId}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }

  return { ok: true };
}
