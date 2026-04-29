"use client";

import { formatClinicalAnonymId } from "@/lib/clinical-anonym-id";

export async function downloadDoctorReportPdf(
  profileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/profile/${encodeURIComponent(profileId)}/doctor-report/pdf`, {
    credentials: "include",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: j.error ?? "Не удалось сформировать PDF" };
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sakbol-vrachu-${formatClinicalAnonymId(profileId)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true };
}
