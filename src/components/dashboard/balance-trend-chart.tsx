"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColors, type ChartPalette } from "@/lib/chart-colors";
import { minutesToHM } from "@/lib/time-calc";

export interface TrendPoint {
  label: string;
  balance: number;
}

function CustomTooltip({ active, payload, colors }: { active?: boolean; payload?: { payload: TrendPoint }[]; colors: ChartPalette }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-md"
      style={{ backgroundColor: colors.surface, borderColor: colors.gridline, color: colors.textPrimary }}
    >
      <p className="font-medium">{point.label}</p>
      <p style={{ color: point.balance >= 0 ? colors.positive : colors.negative }}>
        Saldo acumulado: {minutesToHM(point.balance)}
      </p>
    </div>
  );
}

export function BalanceTrendChart({ data }: { data: TrendPoint[] }) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const colors = mounted && resolvedTheme === "dark" ? chartColors.dark : chartColors.light;
  const last = data[data.length - 1]?.balance ?? 0;
  const lineColor = last >= 0 ? colors.positive : colors.negative;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={colors.gridline} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: colors.baseline }}
          tick={{ fill: colors.muted, fontSize: 11 }}
          interval={Math.max(0, Math.floor(data.length / 6))}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: colors.muted, fontSize: 11 }}
          tickFormatter={(v) => `${(v / 60).toFixed(0)}h`}
          width={40}
        />
        <ReferenceLine y={0} stroke={colors.baseline} />
        <Tooltip content={<CustomTooltip colors={colors} />} />
        <Area
          type="monotone"
          dataKey="balance"
          stroke={lineColor}
          strokeWidth={2}
          fill="url(#balanceFill)"
          dot={false}
          activeDot={{ r: 4, fill: lineColor, stroke: colors.surface, strokeWidth: 2 }}
          isAnimationActive
          animationDuration={600}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
