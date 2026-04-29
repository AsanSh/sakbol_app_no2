/**
 * Скачивание файла документа из /api/documents/:id/file?download=1 (с httpOnly-cookie).
 */
function safeFileBaseName(title: string): string {
  const s = title.replace(/[^\w\u0400-\u04FF\s.-]+/g, "_").trim();
  return s.slice(0, 80) || "document";
}

export async function downloadHealthDocumentClient(
  documentId: string,
  titleHint?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `/api/documents/${encodeURIComponent(documentId)}/file?download=1`;
  const safeName = safeFileBaseName(titleHint || "document");

  function triggerAnchorDownload(href: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = `${safeName}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (
    typeof window !== "undefined" &&
    (window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp
  ) {
    triggerAnchorDownload(url);
    return { ok: true };
  }

  const res = await fetch(url, { credentials: "include", method: "GET" });
  if (!res.ok) {
    if (res.status === 401) {
      return {
        ok: false,
        error:
          "Нужна сессия в этом браузере. Войдите на сайте или откройте мини-приложение в Telegram.",
      };
    }
    const raw = await res.text().catch(() => "");
    try {
      const j = JSON.parse(raw) as { error?: string };
      if (j.error) return { ok: false, error: j.error };
    } catch {
      /* fallthrough */
    }
    return { ok: false, error: raw.trim().slice(0, 200) || `Ошибка ${res.status}` };
  }

  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = safeName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objUrl);
  }
  return { ok: true };
}
