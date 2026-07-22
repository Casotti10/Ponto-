"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColors, type ChartPalette } from "@/lib/chart-colors";
import { minutesToHM } from "@/lib/time-calc";

export interface DailyBalancePoint {
  day: string;
  minutes: number;
  status: string;
}

function CustomTooltip({ active, payload, colors }: { active?: boolean; payload?: { payload: DailyBalancePoint }[]; colors: ChartPalette }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-md"
      style={{ backgroundColor: colors.surface, borderColor: colors.gridline, color: colors.textPrimary }}
    >
      <p className="font-medium">Dia {point.day}</p>
      <p style={{ color: point.minutes >= 0 ? colors.positive : colors.negative }}>
        Saldo: {minutesToHM(point.minutes)}
      </p>
    </div>
  );
}

export function DailyBalanceChart({ data }: { data: DailyBalancePoint[] }) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const colors = mounted && resolvedTheme === "dark" ? chartColors.dark : chartColors.light;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={colors.gridline} strokeDasharray="0" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={{ stroke: colors.baseline }}
          tick={{ fill: colors.muted, fontSize: 11 }}
          interval={data.length > 20 ? 2 : 0}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: colors.muted, fontSize: 11 }}
          tickFormatter={(v) => `${(v / 60).toFixed(0)}h`}
          width={36}
        />
        <ReferenceLine y={0} stroke={colors.baseline} />
        <Tooltip cursor={{ fill: colors.gridline, opacity: 0.4 }} content={<CustomTooltip colors={colors} />} />
        <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive animationDuration={500}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.minutes >= 0 ? colors.positive : colors.negative} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
