"use client";

import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLanguage } from "@/context/language-context";
import { t, type Lang } from "@/lib/i18n";
import {
  getStatusColorHex,
  type DynamicsPoint,
  type MedicalStatus,
} from "@/lib/medical-logic";

type Props = {
  title: string;
  unit: string;
  data: DynamicsPoint[];
  normMin: number | null;
  normMax: number | null;
};

type ChartRow = DynamicsPoint & { label: string };

function renderBiomarkerTooltip(
  active: boolean | undefined,
  payload: unknown,
  title: string,
  unit: string,
  lang: Lang,
) {
  if (!active || !payload || !Array.isArray(payload) || !payload[0]) return null;
  const row = (payload[0] as { payload: ChartRow }).payload;
  const v = row.value;
  const st = row.status ?? "normal";
  const statusHex = getStatusColorHex(st);
  const statusLabel = t(lang, `status.${st}`);

  return (
    <div
      className="rounded-xl border border-emerald-800/20 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
      style={{ fontSize: 12 }}
    >
      <p className="font-semibold text-emerald-950">{title}</p>
      <p className="mt-1 text-emerald-900">
        <span className="tabular-nums font-medium">{v}</span>
        {unit ? (
          <span className="text-emerald-600/70"> {unit}</span>
        ) : null}
      </p>
      <p
        className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
        style={{
          backgroundColor: `${statusHex}22`,
          color: statusHex,
        }}
      >
        {statusLabel}
      </p>
    </div>
  );
}

export function BiomarkerChart({ title, unit, data, normMin, normMax }: Props) {
  const { lang } = useLanguage();
  const chartData: ChartRow[] = data.map((d) => ({
    ...d,
    label: new Date(d.t).toLocaleDateString(lang === "ru" ? "ru-RU" : "ky-KG", {
      day: "numeric",
      month: "short",
    }),
  }));

  const values = data.map((d) => d.value);
  const vmin = Math.min(...values);
  const vmax = Math.max(...values);
  const spread = Math.max(vmax - vmin, Math.abs(vmax) * 0.02, 0.01);
  const pad = spread * 0.15;
  const hasNorm =
    normMin != null &&
    normMax != null &&
    Number.isFinite(normMin) &&
    Number.isFinite(normMax);
  const yMin = (hasNorm ? Math.min(normMin!, vmin) : vmin) - pad;
  const yMax = (hasNorm ? Math.max(normMax!, vmax) : vmax) + pad;

  const dotColorForStatus = (status: MedicalStatus | undefined) =>
    getStatusColorHex(status ?? "normal");

  return (
    <div className="w-full max-w-full overflow-hidden rounded-xl border border-emerald-900/15 bg-white/90 p-3 shadow-sm">
      <p className="mb-1 text-center text-xs font-semibold text-emerald-950">
        {title}
        {unit ? (
          <span className="font-normal text-emerald-600/70"> ({unit})</span>
        ) : null}
      </p>
      <div className="h-[220px] w-full min-w-0 rounded-lg bg-gradient-to-b from-emerald-100/80 via-emerald-50/25 to-transparent">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -18, bottom: 4 }}
          >
            <defs>
              <linearGradient id="biomarkerAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c8ebe4" stopOpacity={0.55} />
                <stop offset="55%" stopColor="#e8f5f3" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#B2DFDB" opacity={0.5} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#004d40" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 10, fill: "#004d40" }}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: "#00695C", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={({ active, payload }) =>
                renderBiomarkerTooltip(active, payload, title, unit, lang)
              }
            />
            {hasNorm ? (
              <ReferenceArea
                y1={normMin!}
                y2={normMax!}
                fill="#B2DFDB"
                fillOpacity={0.45}
                strokeOpacity={0}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill="url(#biomarkerAreaFill)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#00695C"
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) return <g />;
                const st = (payload as ChartRow).status;
                const fill = dotColorForStatus(st);
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={fill}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                );
              }}
              activeDot={{ r: 6, stroke: "#fff", strokeWidth: 1 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasNorm ? (
        <p className="mt-1 text-center text-[10px] text-emerald-600/70">
          Жашыл коридор — куралдагы норма диапазону
        </p>
      ) : null}
    </div>
  );
}
