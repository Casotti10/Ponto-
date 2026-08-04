import { centsToBRL } from "@/lib/ledger-calc";
import type { CategoryBreakdownItem } from "@/lib/ledger-calc";

/**
 * Onde o dinheiro foi parar, por categoria.
 *
 * É uma lista com barras proporcionais, e não uma pizza: a pergunta real é
 * "quanto gastei em cada coisa e em que ordem", que se lê com precisão em
 * rótulo + valor. Fatias circulares forçam comparar ângulos e escondem o valor
 * exato — justamente o que interessa aqui.
 *
 * O rótulo direto ao lado de cada barra também é a codificação secundária que a
 * paleta exige: a identidade da categoria nunca depende só da cor.
 */
export function CategoryBreakdown({
  items,
  emptyLabel,
  maxItems = 6,
}: {
  items: CategoryBreakdownItem[];
  emptyLabel: string;
  maxItems?: number;
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  // A partir do 7º item o excedente vira "Outros" em vez de ganhar uma cor
  // inventada fora da paleta validada.
  const visible = items.slice(0, maxItems);
  const rest = items.slice(maxItems);
  const rows =
    rest.length > 0
      ? [
          ...visible,
          {
            categoryId: "__rest__",
            name: `Outros (${rest.length})`,
            color: "#898781",
            totalCents: rest.reduce((acc, item) => acc + item.totalCents, 0),
            percent: rest.reduce((acc, item) => acc + item.percent, 0),
            transactionCount: rest.reduce((acc, item) => acc + item.transactionCount, 0),
          },
        ]
      : visible;

  const largest = Math.max(...rows.map((r) => r.totalCents), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.categoryId ?? row.name} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate">{row.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{row.percent}%</span>
            </span>
            <span className="shrink-0 tabular-nums font-medium">{centsToBRL(row.totalCents)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (row.totalCents / largest) * 100)}%`,
                backgroundColor: row.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
