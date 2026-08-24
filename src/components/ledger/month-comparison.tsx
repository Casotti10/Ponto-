import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { centsToBRL, centsToSignedBRL } from "@/lib/ledger-calc";
import { cn } from "@/lib/utils";

interface Linha {
  label: string;
  atual: number;
  anterior: number;
  /** Para despesa, subir é ruim; para receita e resultado, subir é bom. */
  subirEhBom: boolean;
  signed?: boolean;
}

/**
 * Comparativo com o mês anterior.
 *
 * A variação em percentual só aparece quando há base para calculá-la: partir de
 * zero não é "aumento de 100%", é aumento a partir do nada, e anunciar um
 * percentual ali seria inventar precisão que o dado não tem.
 *
 * A seta e a palavra carregam a leitura junto com a cor — subir R$ 500 em
 * despesa e subir R$ 500 em receita pintam de cores opostas, e quem não
 * distingue as duas precisa do texto para saber qual é qual.
 */
export function MonthComparison({
  current,
  previous,
  currentLabel,
  previousLabel,
}: {
  current: { incomeCents: number; expenseCents: number; balanceCents: number };
  previous: { incomeCents: number; expenseCents: number; balanceCents: number };
  currentLabel: string;
  previousLabel: string;
}) {
  const linhas: Linha[] = [
    { label: "Receitas", atual: current.incomeCents, anterior: previous.incomeCents, subirEhBom: true },
    { label: "Despesas", atual: current.expenseCents, anterior: previous.expenseCents, subirEhBom: false },
    {
      label: "Resultado",
      atual: current.balanceCents,
      anterior: previous.balanceCents,
      subirEhBom: true,
      signed: true,
    },
  ];

  const semBase = previous.incomeCents === 0 && previous.expenseCents === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comparativo mensal</CardTitle>
        <CardDescription>
          {previousLabel} <ArrowRight className="inline h-3 w-3" aria-label="comparado a" />{" "}
          {currentLabel}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {semBase ? (
          <p className="py-2 text-xs text-muted-foreground">
            Não há lançamentos em {previousLabel.toLowerCase()} para comparar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Indicador</th>
                  <th className="pb-2 text-right font-medium">{previousLabel}</th>
                  <th className="pb-2 text-right font-medium">{currentLabel}</th>
                  <th className="pb-2 text-right font-medium">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map((linha) => {
                  const delta = linha.atual - linha.anterior;
                  // Sem base não há percentual: partir de zero não é "+100%".
                  const percentual =
                    linha.anterior !== 0
                      ? Math.round((delta / Math.abs(linha.anterior)) * 100)
                      : null;

                  const subiu = delta > 0;
                  const estavel = delta === 0;
                  const bom = estavel ? null : subiu === linha.subirEhBom;
                  const Icone = estavel ? Minus : subiu ? TrendingUp : TrendingDown;

                  const fmt = linha.signed ? centsToSignedBRL : centsToBRL;

                  return (
                    <tr key={linha.label}>
                      <td className="py-2 font-medium">{linha.label}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {fmt(linha.anterior)}
                      </td>
                      <td className="py-2 text-right tabular-nums">{fmt(linha.atual)}</td>
                      <td
                        className={cn(
                          "py-2 text-right tabular-nums",
                          bom === null && "text-muted-foreground",
                          bom === true && "text-emerald-600 dark:text-emerald-500",
                          bom === false && "text-red-600 dark:text-red-500"
                        )}
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          <Icone className="h-3.5 w-3.5" aria-hidden />
                          <span>
                            {estavel
                              ? "sem mudança"
                              : percentual !== null
                                ? `${subiu ? "+" : ""}${percentual}%`
                                : `${subiu ? "+" : "−"}${centsToBRL(Math.abs(delta))}`}
                          </span>
                        </span>
                        {!estavel && percentual !== null && (
                          <span className="block text-[11px] opacity-70">
                            {subiu ? "+" : "−"}
                            {centsToBRL(Math.abs(delta))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
