"use client";

import { ArrowDownRight, ArrowUpRight, Hash, Landmark, TrendingUp, TrendingDown } from "lucide-react";
import { centsToBRL, centsToSignedBRL } from "@/lib/ledger-calc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PeriodTotals } from "@/lib/ledger-calc";

interface MonthlySummaryProps {
  totals: PeriodTotals;
  transactions: Array<{ type: "ENTRADA" | "SAIDA"; amountCents: number }>;
  openingCents: number;
  closingCents: number;
  previousMonthBalance?: number;
}

/**
 * Resumo consolidado do mês selecionado.
 *
 * Exibe:
 * - Totais de receita/despesa
 * - Saldo inicial/final
 * - Quantidade de movimentações
 * - Valores médios
 * - Comparação com mês anterior
 */
export function MonthlySummary({
  totals,
  transactions,
  openingCents,
  closingCents,
  previousMonthBalance,
}: MonthlySummaryProps) {
  const incomeCount = transactions.filter((t) => t.type === "ENTRADA").length;
  const expenseCount = transactions.filter((t) => t.type === "SAIDA").length;
  const totalTransactions = transactions.length;

  const avgIncome = incomeCount > 0 ? totals.incomeCents / incomeCount : 0;
  const avgExpense = expenseCount > 0 ? totals.expenseCents / expenseCount : 0;

  const isPositive = totals.balanceCents >= 0;
  const hasComparison = previousMonthBalance !== undefined;

  let comparisonTone: "good" | "bad" | "neutral" = "neutral";
  let comparisonPercent = 0;

  if (hasComparison && previousMonthBalance !== 0) {
    comparisonPercent = ((totals.balanceCents - previousMonthBalance) / Math.abs(previousMonthBalance)) * 100;
    if (totals.balanceCents > previousMonthBalance) {
      comparisonTone = "good";
    } else if (totals.balanceCents < previousMonthBalance) {
      comparisonTone = "bad";
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Resumo do Mês
            </CardTitle>
            <CardDescription>
              {totalTransactions} {totalTransactions === 1 ? "movimentação" : "movimentações"}
            </CardDescription>
          </div>
          <Badge variant={isPositive ? "default" : "destructive"}>
            {isPositive ? "Positivo" : "Negativo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Saldo Inicial */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Saldo Inicial</p>
            <p className="text-lg font-semibold">{centsToBRL(openingCents)}</p>
          </div>

          {/* Saldo Final */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Saldo Final</p>
            <p className="text-lg font-semibold">{centsToBRL(closingCents)}</p>
          </div>

          {/* Total de Receitas */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              Total de Receitas
            </p>
            <p className="text-lg font-semibold text-green-600">{centsToBRL(totals.incomeCents)}</p>
            <p className="text-xs text-muted-foreground">
              {incomeCount} × Média: {centsToBRL(avgIncome)}
            </p>
          </div>

          {/* Total de Despesas */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <ArrowDownRight className="h-4 w-4 text-red-600" />
              Total de Despesas
            </p>
            <p className="text-lg font-semibold text-red-600">{centsToBRL(totals.expenseCents)}</p>
            <p className="text-xs text-muted-foreground">
              {expenseCount} × Média: {centsToBRL(avgExpense)}
            </p>
          </div>

          {/* Saldo do Mês */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              Saldo do Mês
            </p>
            <p className={`text-lg font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}>
              {centsToSignedBRL(totals.balanceCents)}
            </p>
          </div>

          {/* Quantidade de Lançamentos */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Hash className="h-4 w-4" />
              Lançamentos
            </p>
            <p className="text-lg font-semibold tabular-nums">{totalTransactions}</p>
            <p className="text-xs text-muted-foreground">
              {incomeCount} entrada(s) · {expenseCount} saída(s)
            </p>
          </div>

          {/* Comparação com Mês Anterior */}
          {hasComparison && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Vs. Mês Anterior</p>
              <p
                className={`text-lg font-semibold ${
                  comparisonTone === "good"
                    ? "text-green-600"
                    : comparisonTone === "bad"
                      ? "text-red-600"
                      : "text-muted-foreground"
                }`}
              >
                {comparisonPercent > 0 ? "+" : ""}
                {comparisonPercent.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {comparisonPercent > 0 ? "Melhor" : "Pior"} que mês anterior
              </p>
            </div>
          )}
        </div>

        {/* Taxa de Poupança */}
        {totals.incomeCents > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">Taxa de Poupança</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${totals.savingsRate}%` }}
                />
              </div>
              <span className="font-semibold text-sm">{totals.savingsRate}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Você poupou {centsToBRL(totals.balanceCents)} de {centsToBRL(totals.incomeCents)} recebido
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
