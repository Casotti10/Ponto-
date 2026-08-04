"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColors, ledgerColors, type ChartPalette, type LedgerPalette } from "@/lib/chart-colors";
import { centsToBRL, centsToBRLCompact } from "@/lib/ledger-calc";

export interface CashflowPoint {
  day: number;
  label: string;
  incomeCents: number;
  /** Já vem negativo, para desenhar abaixo da linha zero. */
  expenseCents: number;
  runningCents: number;
}

function CashflowTooltip({
  active,
  payload,
  colors,
  series,
}: {
  active?: boolean;
  payload?: { payload: CashflowPoint }[];
  colors: ChartPalette;
  series: LedgerPalette;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-md"
      style={{ backgroundColor: colors.surface, borderColor: colors.gridline, color: colors.textPrimary }}
    >
      <p className="mb-1 font-medium">Dia {point.label}</p>
      {point.incomeCents > 0 && (
        <p className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: series.income }} />
          <span style={{ color: colors.textSecondary }}>Entradas:</span> {centsToBRL(point.incomeCents)}
        </p>
      )}
      {point.expenseCents < 0 && (
        <p className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: series.expense }} />
          <span style={{ color: colors.textSecondary }}>Saídas:</span> {centsToBRL(-point.expenseCents)}
        </p>
      )}
      <p className="mt-1 border-t pt-1 font-medium" style={{ borderColor: colors.gridline }}>
        Saldo acumulado: {centsToBRL(point.runningCents)}
      </p>
    </div>
  );
}

/**
 * Fluxo de caixa do mês: barras de entrada/saída por dia + linha do saldo
 * acumulado.
 *
 * A linha e as barras compartilham UM único eixo Y (tudo é dinheiro em
 * centavos) — nunca um segundo eixo, que faria a relação entre as duas séries
 * parecer o que a escala escolheu, e não o que os dados dizem.
 */
export function CashflowChart({ data }: { data: CashflowPoint[] }) {
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
          Entradas
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.expense }} />
          Saídas
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-0.5 w-3.5 rounded-full" style={{ backgroundColor: series.balance }} />
          Saldo acumulado
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={colors.gridline} strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: colors.baseline }}
            tick={{ fill: colors.muted, fontSize: 11 }}
            interval={data.length > 20 ? 2 : 0}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.muted, fontSize: 11 }}
            tickFormatter={(v) => centsToBRLCompact(v)}
            width={68}
          />
          <ReferenceLine y={0} stroke={colors.baseline} />
          <Tooltip
            cursor={{ fill: colors.gridline, opacity: 0.4 }}
            content={<CashflowTooltip colors={colors} series={series} />}
          />
          <Bar dataKey="incomeCents" fill={series.income} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expenseCents" fill={series.expense} radius={[0, 0, 4, 4]} maxBarSize={18} />
          <Line
            type="monotone"
            dataKey="runningCents"
            stroke={series.balance}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: colors.surface }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
