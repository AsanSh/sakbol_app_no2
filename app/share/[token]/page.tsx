import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveLabAnalysisPayload } from "@/lib/resolve-lab-payload";

export const dynamic = "force-dynamic";

/** Упрощённый экран для врача: без лишнего chrome, крупная типографика. */
export default async function SharePage({ params }: { params: { token: string } }) {
  const row = await prisma.shareToken.findUnique({
    where: { token: params.token },
    include: {
      healthRecord: { include: { profile: true, metrics: { select: { payload: true } } } },
    },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) notFound();

  const data = resolveLabAnalysisPayload(
    row.healthRecord.data,
    row.healthRecord.metrics?.payload ?? null,
  );
  const profileName = row.healthRecord.profile.displayName;

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-lg px-4 py-8">
        <header className="border-b border-slate-200 pb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">SakBol · врачу</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">Результаты анализа</h1>
          <p className="mt-2 text-sm text-slate-600">
            Пациент: <span className="font-semibold text-slate-800">{profileName}</span>
          </p>
          <p className="mt-1 text-xs text-amber-700">Доступ по ссылке истекает через 15 минут.</p>
        </header>

        <a
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-emerald-800 px-4 py-3 text-center text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-95"
          href={`/api/share/${params.token}/file`}
          target="_blank"
          rel="noreferrer"
        >
          Открыть оригинал документа (без маскировки)
        </a>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-700">Показатели</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {data?.biomarkers?.length ? (
              data.biomarkers.map((b, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-800">{b.biomarker}</span>
                  <span className="text-slate-900">
                    <strong>
                      {b.value} {b.unit}
                    </strong>
                    {b.reference ? (
                      <span className="ml-2 text-xs text-slate-500">реф. {b.reference}</span>
                    ) : null}
                  </span>
                </li>
              ))
            ) : (
              <li className="px-4 py-6 text-center text-sm text-slate-500">Нет распознанных показателей</li>
            )}
          </ul>
        </section>

        <p className="mt-8 text-center text-xs text-slate-500">
          Справочная информация. Интерпретация — зона ответственности лечащего врача.
        </p>
        <Link
          href="/"
          className="mt-4 block text-center text-sm font-medium text-emerald-800 underline underline-offset-2"
        >
          На главную SakBol
        </Link>
      </div>
    </main>
  );
}
