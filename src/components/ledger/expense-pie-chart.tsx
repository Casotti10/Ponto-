"use client";

import { useTheme } from "next-themes";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { useMounted } from "@/lib/use-mounted";
import { chartColors, categoryFallbackColor, type ChartPalette } from "@/lib/chart-colors";
import { centsToBRL } from "@/lib/ledger-calc";
import type { CategoryBreakdownItem } from "@/lib/ledger-calc";

/**
 * Para onde o dinheiro foi no mês, em proporção.
 *
 * Rosca e não pizza cheia: o miolo carrega o total do mês, que é a primeira
 * coisa que se quer saber ao olhar para "quanto gastei". A leitura de ângulo
 * responde "que fatia domina"; o valor exato de cada categoria vem na lista ao
 * lado, nunca do ângulo.
 *
 * A lista não é decoração — é obrigatória. A paleta de categorias
 * (`chart-colors.ts`) tem pares que caem na faixa 6–8 de separação sob
 * daltonismo, o que só é legítimo com codificação secundária. Nome + valor ao
 * lado de cada marca é essa codificação: a identidade da fatia nunca depende só
 * da cor.
 *
 * Teto de 6 fatias + "Outros": passando disso as fatias adjacentes borram e a
 * paleta validada teria que inventar cor nova — a mesma regra que
 * `CategoryBreakdown` já aplica.
 */

const MAX_SLICES = 6;

interface Slice {
  key: string;
  name: string;
  color: string;
  totalCents: number;
  percent: number;
  transactionCount: number;
}

function PieTooltip({
  active,
  payload,
  colors,
  totalCents,
}: {
  active?: boolean;
  payload?: { payload: Slice }[];
  colors: ChartPalette;
  totalCents: number;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  const share = totalCents > 0 ? (slice.totalCents / totalCents) * 100 : 0;

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-md"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.gridline,
        color: colors.textPrimary,
      }}
    >
      <p className="mb-1 flex items-center gap-1.5 font-medium">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: slice.color }}
        />
        {slice.name}
      </p>
      <p style={{ color: colors.textSecondary }}>
        {centsToBRL(slice.totalCents)} · {share.toFixed(1)}%
      </p>
      <p style={{ color: colors.textSecondary }}>
        {slice.transactionCount} lançamento(s)
      </p>
    </div>
  );
}

export function ExpensePieChart({
  items,
  monthLabel,
}: {
  items: CategoryBreakdownItem[];
  monthLabel: string;
}) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  const colors = dark ? chartColors.dark : chartColors.light;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
        <PieChartIcon className="h-8 w-8 text-muted-foreground/50" aria-hidden />
        <p className="text-sm font-medium">Nenhuma despesa em {monthLabel}</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Assim que houver saídas neste mês, elas aparecem aqui divididas por categoria.
        </p>
      </div>
    );
  }

  const visible = items.slice(0, MAX_SLICES);
  const rest = items.slice(MAX_SLICES);

  const slices: Slice[] = [
    ...visible.map((item) => ({
      key: item.categoryId ?? "__none__",
      name: item.name,
      color: item.color,
      totalCents: item.totalCents,
      percent: item.percent,
      transactionCount: item.transactionCount,
    })),
    ...(rest.length > 0
      ? [
          {
            key: "__rest__",
            name: `Outros (${rest.length})`,
            color: dark ? categoryFallbackColor.dark : categoryFallbackColor.light,
            totalCents: rest.reduce((acc, item) => acc + item.totalCents, 0),
            percent: rest.reduce((acc, item) => acc + item.percent, 0),
            transactionCount: rest.reduce((acc, item) => acc + item.transactionCount, 0),
          },
        ]
      : []),
  ];

  const totalCents = slices.reduce((acc, slice) => acc + slice.totalCents, 0);

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center">
      <div className="relative w-full max-w-64 shrink-0">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="totalCents"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={100}
              paddingAngle={1}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell
                  key={slice.key}
                  fill={slice.color}
                  // Anel de 2px na cor da superfície: separa fatias vizinhas por
                  // geometria, não só por cor.
                  stroke={colors.surface}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              content={<PieTooltip colors={colors} totalCents={totalCents} />}
              wrapperStyle={{ outline: "none" }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* O total vive no miolo da rosca, onde o olho já está. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total gasto</span>
          <span className="text-lg font-semibold tabular-nums">{centsToBRL(totalCents)}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-2">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: slice.color }}
                aria-hidden
              />
              <span className="truncate">{slice.name}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
              <span className="text-xs text-muted-foreground">
                {totalCents > 0 ? Math.round((slice.totalCents / totalCents) * 100) : 0}%
              </span>
              <span className="font-medium">{centsToBRL(slice.totalCents)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
