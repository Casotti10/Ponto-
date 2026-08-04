import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Plus,
  Landmark,
  Tags,
  Repeat,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requireUser } from "@/lib/auth";
import { getLedgerOverview } from "@/lib/ledger-service";
import { centsToBRL, centsToSignedBRL, MONTH_NAMES } from "@/lib/ledger-calc";
import { ledgerColors } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LedgerPeriodPicker } from "@/components/ledger/ledger-period-picker";
import { TransactionFormDialog } from "@/components/ledger/transaction-form-dialog";
import { TransactionRowActions } from "@/components/ledger/transaction-row-actions";
import { CashflowChart, type CashflowPoint } from "@/components/ledger/cashflow-chart";
import { YearBalanceChart, type YearBalancePoint } from "@/components/ledger/year-balance-chart";
import { CategoryBreakdown } from "@/components/ledger/category-breakdown";
import { AccountsManager } from "@/components/ledger/accounts-manager";
import { CategoriesManager } from "@/components/ledger/categories-manager";
import { RecurringManager } from "@/components/ledger/recurring-manager";
import { FinancialExportButtons } from "@/components/ledger/ledger-export-buttons";
import type { ExportTable } from "@/lib/export-utils";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();

  const year = Number(params.year) || now.getFullYear();
  const month = Math.min(12, Math.max(1, Number(params.month) || now.getMonth() + 1));

  const overview = await getLedgerOverview(user.id, year, month, now);
  const { totals, transactions, accounts, categories, recurrences } = overview;

  const activeAccounts = accounts.filter((a) => !a.archived);
  const accountOptions = activeAccounts.map((a) => ({ id: a.id, name: a.name }));

  const cashflowData: CashflowPoint[] = overview.dailyFlow.map((point) => ({
    day: point.day,
    label: point.label,
    incomeCents: point.incomeCents,
    expenseCents: -point.expenseCents,
    runningCents: point.runningCents,
  }));

  const yearData: YearBalancePoint[] = overview.yearSeries.map((point) => ({
    label: point.label,
    incomeCents: point.incomeCents,
    expenseCents: point.expenseCents,
    balanceCents: point.balanceCents,
    isCurrent: point.month === month,
  }));

  const exportTable: ExportTable = {
    sheetName: "Lançamentos",
    headers: ["Data", "Descrição", "Tipo", "Categoria", "Conta", "Valor"],
    rows: transactions.map((tx) => [
      tx.date.toLocaleDateString("pt-BR"),
      tx.description,
      tx.type === "ENTRADA" ? "Entrada" : "Saída",
      tx.categoryName ?? "Sem categoria",
      tx.accountName,
      `${tx.type === "ENTRADA" ? "" : "-"}${(tx.amountCents / 100).toFixed(2).replace(".", ",")}`,
    ]),
  };

  const totalCash = activeAccounts.reduce((acc, a) => acc + a.balanceCents, 0);
  const isPositive = totals.balanceCents >= 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Wallet className="h-6 w-6" /> Financeiro
          </h1>
          <p className="text-muted-foreground">
            Suas entradas e saídas de {MONTH_NAMES[month - 1].toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LedgerPeriodPicker
            year={year}
            month={month}
            currentYear={now.getFullYear()}
            currentMonth={now.getMonth() + 1}
          />
          <TransactionFormDialog
            accounts={accountOptions}
            categories={categories}
            trigger={<Button className="gap-1.5" />}
          >
            <Plus className="h-4 w-4" /> Novo lançamento
          </TransactionFormDialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Entradas do mês"
          value={centsToBRL(totals.incomeCents)}
          icon={ArrowUpRight}
          tone="good"
          iconColor={ledgerColors.light.income}
        />
        <StatCard
          label="Saídas do mês"
          value={centsToBRL(totals.expenseCents)}
          icon={ArrowDownRight}
          tone={totals.expenseCents > 0 ? "bad" : "neutral"}
          iconColor={ledgerColors.light.expense}
        />
        <StatCard
          label="Saldo do mês"
          value={centsToSignedBRL(totals.balanceCents)}
          icon={isPositive ? TrendingUp : TrendingDown}
          tone={isPositive ? "good" : "bad"}
          iconColor={isPositive ? ledgerColors.light.income : ledgerColors.light.expense}
          hint={
            totals.incomeCents > 0
              ? `Sobrou ${totals.savingsRate}% do que entrou`
              : "Sem entradas registradas"
          }
        />
        <StatCard
          label="Dinheiro em caixa"
          value={centsToBRL(totalCash)}
          icon={PiggyBank}
          tone={totalCash >= 0 ? "good" : "bad"}
          iconColor={ledgerColors.light.balance}
          hint={`${activeAccounts.length} conta(s)`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Fluxo de caixa</CardTitle>
            <CardDescription>
              Entradas e saídas por dia, com o saldo acumulado partindo de{" "}
              {centsToBRL(overview.openingCents)} — quanto você já tinha no começo do mês.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <CashflowChart data={cashflowData} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhum lançamento neste mês ainda.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo de {MONTH_NAMES[month - 1]}</CardTitle>
            <CardDescription>Como o mês fecha</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y">
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">Saldo inicial</span>
                <span className="tabular-nums">{centsToBRL(overview.openingCents)}</span>
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">Entradas</span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{centsToBRL(totals.incomeCents)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">Saídas</span>
                <span className="tabular-nums text-red-600 dark:text-red-400">
                  −{centsToBRL(totals.expenseCents)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 text-sm font-semibold">
                <span>Saldo do mês</span>
                <span
                  className={cn(
                    "tabular-nums",
                    isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}
                >
                  {centsToSignedBRL(totals.balanceCents)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 text-sm font-semibold">
                <span>Saldo final</span>
                <span className="tabular-nums">{centsToBRL(overview.closingCents)}</span>
              </div>
            </div>

            {totals.biggestExpense && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Maior gasto do mês</p>
                <p className="truncate text-sm font-medium">{totals.biggestExpense.description}</p>
                <p className="text-sm tabular-nums text-red-600 dark:text-red-400">
                  {centsToBRL(totals.biggestExpense.amountCents)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Para onde foi o dinheiro</CardTitle>
            <CardDescription>Saídas do mês por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown
              items={overview.expensesByCategory}
              emptyLabel="Nenhuma saída registrada neste mês."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>De onde veio o dinheiro</CardTitle>
            <CardDescription>Entradas do mês por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown
              items={overview.incomeByCategory}
              emptyLabel="Nenhuma entrada registrada neste mês."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saldo mês a mês em {year}</CardTitle>
          <CardDescription>
            Quanto sobrou (ou faltou) em cada mês. Acima da linha, o mês fechou no azul.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <YearBalanceChart data={yearData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Lançamentos</CardTitle>
            <CardDescription>
              {totals.transactionCount} lançamento(s) em {MONTH_NAMES[month - 1]}
            </CardDescription>
          </div>
          <FinancialExportButtons
            table={exportTable}
            filename={`financeiro-${year}-${String(month).padStart(2, "0")}`}
            title={`Lançamentos — ${MONTH_NAMES[month - 1]}/${year}`}
          />
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento neste mês. Registre a primeira entrada ou saída.
              </p>
              <TransactionFormDialog
                accounts={accountOptions}
                categories={categories}
                trigger={<Button variant="outline" className="gap-1.5" />}
              >
                <Plus className="h-4 w-4" /> Novo lançamento
              </TransactionFormDialog>
            </div>
          ) : (
            <div className="max-h-[560px] divide-y overflow-auto rounded-lg border">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 p-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `${tx.categoryColor ?? (tx.type === "ENTRADA" ? ledgerColors.light.income : ledgerColors.light.expense)}1a`,
                      color: tx.categoryColor ?? (tx.type === "ENTRADA" ? ledgerColors.light.income : ledgerColors.light.expense),
                    }}
                  >
                    {tx.type === "ENTRADA" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {tx.description}
                      {tx.recurringId && (
                        <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Recorrente" />
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {format(tx.date, "dd 'de' MMM", { locale: ptBR })} · {tx.accountName}
                    </p>
                  </div>

                  <div className="hidden shrink-0 sm:block">
                    {tx.categoryName ? (
                      <Badge variant="secondary" className="gap-1.5">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: tx.categoryColor ?? "#898781" }}
                        />
                        {tx.categoryName}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sem categoria</Badge>
                    )}
                  </div>

                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      tx.type === "ENTRADA"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {tx.type === "ENTRADA" ? "+" : "−"}
                    {centsToBRL(tx.amountCents)}
                  </span>

                  <TransactionRowActions
                    accounts={accountOptions}
                    categories={categories}
                    isRecurring={!!tx.recurringId}
                    transaction={{
                      id: tx.id,
                      date: format(tx.date, "yyyy-MM-dd"),
                      description: tx.description,
                      amount: (tx.amountCents / 100).toFixed(2).replace(".", ","),
                      type: tx.type,
                      accountId: tx.accountId,
                      categoryId: tx.categoryId,
                      notes: tx.notes,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4" /> Contas e carteiras
            </CardTitle>
            <CardDescription>
              O saldo é o valor inicial mais todos os lançamentos da conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AccountsManager accounts={accounts} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" /> Categorias
            </CardTitle>
            <CardDescription>Usadas para agrupar os gráficos por tipo de gasto e receita.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoriesManager categories={categories} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4" /> Lançamentos recorrentes
          </CardTitle>
          <CardDescription>
            Contas fixas que se repetem sozinhas — aluguel, salário, assinaturas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecurringManager
            recurrences={recurrences}
            accounts={accountOptions}
            categories={categories}
          />
        </CardContent>
      </Card>

      <p className="pb-6 text-center text-xs text-muted-foreground">
        Ponto+ · Controle financeiro pessoal · {now.getFullYear()}
      </p>
    </div>
  );
}
