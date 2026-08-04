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
import { chartColors, ledgerColors, type ChartPalette } from "@/lib/chart-colors";
import { centsToBRL, centsToBRLCompact } from "@/lib/ledger-calc";

export interface YearBalancePoint {
  label: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  isCurrent: boolean;
}

function YearTooltip({
  active,
  payload,
  colors,
}: {
  active?: boolean;
  payload?: { payload: YearBalancePoint }[];
  colors: ChartPalette;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-md"
      style={{ backgroundColor: colors.surface, borderColor: colors.gridline, color: colors.textPrimary }}
    >
      <p className="mb-1 font-medium">{point.label}</p>
      <p style={{ color: colors.textSecondary }}>Entradas: {centsToBRL(point.incomeCents)}</p>
      <p style={{ color: colors.textSecondary }}>Saídas: {centsToBRL(point.expenseCents)}</p>
      <p className="mt-1 border-t pt-1 font-medium" style={{ borderColor: colors.gridline }}>
        Saldo: {centsToBRL(point.balanceCents)}
      </p>
    </div>
  );
}

/**
 * Saldo de cada mês do ano.
 *
 * Série única com polaridade: a cor codifica o sinal (mês que sobrou dinheiro
 * vs. mês que faltou), não a identidade — por isso não há caixa de legenda de
 * categorias, e sim a leitura direta acima/abaixo da linha zero.
 */
export function YearBalanceChart({ data }: { data: YearBalancePoint[] }) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  const colors = dark ? chartColors.dark : chartColors.light;
  const series = dark ? ledgerColors.dark : ledgerColors.light;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.income }} />
          Mês positivo
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.expense }} />
          Mês negativo
        </span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid vertical={false} stroke={colors.gridline} strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: colors.baseline }}
            tick={{ fill: colors.muted, fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 11 }}
            tickFormatter={(v) => centsToBRLCompact(v)}
            width={68}
          />
          <ReferenceLine y={0} stroke={colors.baseline} />
          <Tooltip cursor={{ fill: colors.gridline, opacity: 0.4 }} content={<YearTooltip colors={colors} />} />
          <Bar dataKey="balanceCents" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((point, index) => (
              <Cell
                key={index}
                fill={point.balanceCents >= 0 ? series.income : series.expense}
                stroke={point.isCurrent ? colors.textPrimary : undefined}
                strokeWidth={point.isCurrent ? 1.5 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
