import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { HealthRecordAnalysisPayload } from "@/types/biomarker";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: { token: string } }) {
  const row = await prisma.shareToken.findUnique({
    where: { token: params.token },
    include: { healthRecord: { include: { profile: true } } },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) notFound();
  const data = row.healthRecord.data as HealthRecordAnalysisPayload;
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-2xl font-semibold text-emerald-950">Shared Medical Record</h1>
      <p className="mt-1 text-sm text-emerald-900/70">Профиль: {row.healthRecord.profile.displayName}</p>
      <a className="mt-3 inline-block rounded-lg bg-emerald-900 px-3 py-2 text-sm text-mint" href={`/api/share/${params.token}/file`} target="_blank" rel="noreferrer">Открыть оригинал документа</a>
      <ul className="mt-4 space-y-2 rounded-xl border border-emerald-900/20 bg-white p-3">
        {data?.biomarkers?.map((b, i) => (
          <li key={i} className="text-sm text-emerald-950">{b.biomarker}: <strong>{b.value} {b.unit}</strong> ({b.reference})</li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-emerald-800/70">Ссылка активна 15 минут.</p>
      <Link href="/" className="mt-2 inline-block text-sm text-emerald-900 underline">На главную</Link>
    </main>
  );
}
