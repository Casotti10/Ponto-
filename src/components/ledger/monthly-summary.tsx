"use client";

import { ArrowDownRight, ArrowUpRight, Landmark, TrendingUp, TrendingDown, Wallet } from "lucide-react";
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
 * Design visual melhorado com cards destacados e melhor organização.
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
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 p-2">
                <Landmark className="h-5 w-5 text-white" />
              </div>
              Resumo do Mês
            </CardTitle>
            <CardDescription className="mt-1">
              {totalTransactions} {totalTransactions === 1 ? "movimentação" : "movimentações"} registradas
            </CardDescription>
          </div>
          <Badge
            className={`text-sm font-semibold px-3 py-1 ${
              isPositive
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {isPositive ? "✓ Positivo" : "✗ Negativo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seção: Saldos */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldos</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Saldo Inicial */}
            <div className="rounded-lg border border-border/50 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Saldo Inicial</p>
                  <p className="text-2xl font-bold">{centsToBRL(openingCents)}</p>
                </div>
                <Wallet className="h-8 w-8 text-blue-400 opacity-30" />
              </div>
            </div>

            {/* Saldo Final */}
            <div className={`rounded-lg border-2 p-4 ${
              isPositive
                ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900"
                : "border-red-300 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900"
            }`}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Saldo Final</p>
                  <p className={`text-2xl font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {centsToBRL(closingCents)}
                  </p>
                </div>
                {isPositive ? (
                  <TrendingUp className="h-8 w-8 text-emerald-400 opacity-30" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-400 opacity-30" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Seção: Fluxo de Caixa */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fluxo de Caixa</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Total de Receitas */}
            <div className="rounded-lg border border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-200 dark:bg-emerald-800 p-2">
                      <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Receitas</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-200/50 dark:bg-emerald-800/50 px-2 py-1 rounded">
                    {incomeCount}x
                  </span>
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {centsToBRL(totals.incomeCents)}
                </p>
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-muted-foreground">
                    Média: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{centsToBRL(avgIncome)}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Total de Despesas */}
            <div className="rounded-lg border border-red-300 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-red-200 dark:bg-red-800 p-2">
                      <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Despesas</p>
                  </div>
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-200/50 dark:bg-red-800/50 px-2 py-1 rounded">
                    {expenseCount}x
                  </span>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {centsToBRL(totals.expenseCents)}
                </p>
                <div className="pt-2 border-t border-red-200 dark:border-red-800">
                  <p className="text-xs text-muted-foreground">
                    Média: <span className="font-semibold text-red-600 dark:text-red-400">{centsToBRL(avgExpense)}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seção: Resultado do Mês */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resultado</h3>
          <div className="rounded-lg border-2 p-4" style={{
            borderColor: isPositive ? 'rgb(16 185 129)' : 'rgb(239 68 68)',
            backgroundColor: isPositive
              ? 'rgb(240 253 250)'
              : 'rgb(254 242 242)',
          }}>
            <div className="flex items-end justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Saldo do Mês</p>
                <p className={`text-3xl font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {centsToSignedBRL(totals.balanceCents)}
                </p>
              </div>
              {isPositive ? (
                <TrendingUp className="h-12 w-12 text-emerald-400 opacity-20" />
              ) : (
                <TrendingDown className="h-12 w-12 text-red-400 opacity-20" />
              )}
            </div>

            {/* Comparação com Mês Anterior */}
            {hasComparison && (
              <div className="mt-4 pt-4 border-t" style={{
                borderColor: isPositive ? 'rgb(167 243 208)' : 'rgb(254 205 211)'
              }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Comparado ao mês anterior</p>
                  <div className={`flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-md ${
                    comparisonTone === "good"
                      ? "bg-emerald-200 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                      : comparisonTone === "bad"
                        ? "bg-red-200 dark:bg-red-900 text-red-700 dark:text-red-300"
                        : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  }`}>
                    {comparisonPercent > 0 ? "↑" : comparisonPercent < 0 ? "↓" : "→"}
                    {comparisonPercent > 0 ? "+" : ""}
                    {comparisonPercent.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Taxa de Poupança */}
        {totals.incomeCents > 0 && (
          <div className="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-4 border border-purple-300 dark:border-purple-700">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">Taxa de Poupança</p>
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totals.savingsRate}%</span>
              </div>

              {/* Barra de Poupança Visual */}
              <div className="space-y-2">
                <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                    style={{ width: `${totals.savingsRate}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Você poupou <span className="font-semibold text-purple-600 dark:text-purple-400">{centsToBRL(totals.balanceCents)}</span> de{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{centsToBRL(totals.incomeCents)}</span> recebido
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
