import { AlertTriangle, CheckCircle2, Info, Lightbulb, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/ledger-calc";

const STYLES: Record<
  Insight["kind"],
  { icon: typeof Info; className: string; label: string }
> = {
  alerta: {
    icon: AlertTriangle,
    className: "border-red-600/30 bg-red-600/5 text-red-700 dark:text-red-400",
    label: "Alerta",
  },
  atencao: {
    icon: TriangleAlert,
    className: "border-amber-600/30 bg-amber-600/5 text-amber-700 dark:text-amber-500",
    label: "Atenção",
  },
  positivo: {
    icon: CheckCircle2,
    className: "border-emerald-600/30 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400",
    label: "Positivo",
  },
  informacao: {
    icon: Info,
    className: "border-border bg-muted/40 text-foreground",
    label: "Informação",
  },
};

/**
 * O que os números do mês querem dizer.
 *
 * Cada frase sai de uma conta sobre lançamentos que existem — um insight sem
 * base simplesmente não é gerado. Por isso a lista pode vir curta, e vir curta
 * é melhor que preenchê-la com observações genéricas que não dizem nada sobre
 * ESTE mês.
 *
 * O tipo do insight nunca depende só da cor: cada linha carrega ícone e um
 * rótulo textual acessível.
 */
export function FinancialInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4" /> Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-2 text-xs text-muted-foreground">
            Ainda não há lançamentos suficientes neste mês para dizer algo útil. Registre
            movimentações e as observações aparecem aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4" /> Insights
        </CardTitle>
        <CardDescription>Calculado a partir dos seus lançamentos deste mês.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {insights.map((insight) => {
          const style = STYLES[insight.kind];
          const Icon = style.icon;
          return (
            <div
              key={insight.id}
              className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2.5", style.className)}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="sr-only">{style.label}: </span>
                  {insight.title}
                </p>
                <p className="text-xs opacity-80">{insight.detail}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
