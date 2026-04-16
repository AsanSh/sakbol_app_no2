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
    return { ok: false, error: message };
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
