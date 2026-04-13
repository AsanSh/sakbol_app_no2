"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DynamicsPoint } from "@/lib/medical-logic";

type Props = {
  title: string;
  unit: string;
  data: DynamicsPoint[];
  normMin: number | null;
  normMax: number | null;
};

export function BiomarkerChart({ title, unit, data, normMin, normMax }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.t).toLocaleDateString("ky-KG", {
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

  return (
    <div className="w-full max-w-full overflow-hidden rounded-xl border border-emerald-900/15 bg-white/90 p-3 shadow-sm">
      <p className="mb-1 text-center text-xs font-semibold text-emerald-950">
        {title}
        {unit ? (
          <span className="font-normal text-emerald-800/70"> ({unit})</span>
        ) : null}
      </p>
      <div className="h-[220px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -18, bottom: 4 }}
          >
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
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid rgba(0,105,92,0.2)",
                fontSize: "12px",
              }}
              formatter={(v) =>
                [`${v ?? ""} ${unit}`.trim(), title] as [string, string]
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
            <Line
              type="monotone"
              dataKey="value"
              stroke="#00695C"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#00695C", stroke: "#fff", strokeWidth: 1 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasNorm ? (
        <p className="mt-1 text-center text-[10px] text-emerald-800/60">
          Жашыл коридор — куралдагы норма диапазону
        </p>
      ) : null}
    </div>
  );
}
