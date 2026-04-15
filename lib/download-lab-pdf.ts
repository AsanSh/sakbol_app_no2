/**
 * Скачивание PDF анализа в том же контексте, где есть httpOnly cookie.
 * Нельзя открывать /api/.../pdf через Telegram.openLink — внешний браузер без сессии → 401.
 */
export async function downloadLabPdfClient(recordId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/analyses/${recordId}/pdf`, {
    credentials: "include",
    method: "GET",
  });

  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: j.error ?? res.statusText };
    }
    return { ok: false, error: res.statusText || "Request failed" };
  }

  const blob = await res.blob();
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
