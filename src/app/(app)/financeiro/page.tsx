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
import { getLedgerOverviewFiltered } from "@/lib/ledger-service";
import { centsToBRL, centsToSignedBRL, MONTH_NAMES } from "@/lib/ledger-calc";
import { ledgerColors } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LedgerPeriodPicker } from "@/components/ledger/ledger-period-picker";
import { AccountFilter } from "@/components/ledger/account-filter";
import { MonthlySummary } from "@/components/ledger/monthly-summary";
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
  searchParams: Promise<{ year?: string; month?: string; accountId?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();

  const year = Number(params.year) || now.getFullYear();
  const month = Math.min(12, Math.max(1, Number(params.month) || now.getMonth() + 1));
  const accountId = params.accountId || null;

  const overview = await getLedgerOverviewFiltered(user.id, year, month, accountId, now);
  const { totals, transactions, accounts, allAccounts, categories, recurrences } = overview;

  // ✅ CORRIGIDO: Use allAccounts para o manager (sempre tem todas)
  // e accounts (filtradas) apenas para cálculos de totalCash
  const accountsForManager = allAccounts || accounts; // Fallback para compatibilidade
  const activeAccounts = accounts.filter((a) => !a.archived);
  const accountOptions = activeAccounts.map((a) => ({ id: a.id, name: a.name }));

  // ✅ CRÍTICO: Agora totalCash respeita o filtro!
  // Se há filtro: soma apenas a conta filtrada
  // Se não há filtro: soma todas as contas (accounts === allAccounts)
  const totalCash = activeAccounts.reduce((acc, a) => acc + a.balanceCents, 0);

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

  const isPositive = totals.balanceCents >= 0;

  // Calcular comparação com mês anterior
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonthOverview = await getLedgerOverviewFiltered(
    user.id,
    previousYear,
    previousMonth,
    accountId,
    now
  );
  const previousMonthBalance = previousMonthOverview.totals.balanceCents;

  // Determinar conta selecionada para exibição
  const selectedAccount = accountId ? accounts.find((a) => a.id === accountId) : null;
  const accountLabel = selectedAccount ? `${selectedAccount.name}` : "Todos os bancos";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Wallet className="h-6 w-6" /> Financeiro
          </h1>
          <p className="text-muted-foreground">
            Suas entradas e saídas de {MONTH_NAMES[month - 1].toLowerCase()} {accountId && `· ${accountLabel}`}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AccountFilter accounts={accounts} />
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

      {transactions.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Nenhum lançamento neste período
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Selecione outro banco ou período, ou registre a primeira movimentação.
            </p>
            <TransactionFormDialog
              accounts={accountOptions}
              categories={categories}
              trigger={<Button variant="outline" size="sm" className="gap-1.5 mt-2" />}
            >
              <Plus className="h-4 w-4" /> Novo lançamento
            </TransactionFormDialog>
          </CardContent>
        </Card>
      ) : (
        <>
          <MonthlySummary
            totals={totals}
            transactions={transactions}
            openingCents={overview.openingCents}
            closingCents={overview.closingCents}
            previousMonthBalance={previousMonthBalance}
          />

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
                <CashflowChart data={cashflowData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Maior gasto</CardTitle>
                <CardDescription>Do mês selecionado</CardDescription>
              </CardHeader>
              <CardContent>
                {totals.biggestExpense ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Descrição</p>
                      <p className="truncate text-sm font-medium">{totals.biggestExpense.description}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                        {centsToBRL(totals.biggestExpense.amountCents)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma saída neste período
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

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
            <div className="max-h-140 divide-y overflow-auto rounded-lg border">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 p-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `${tx.accountColor}20`,
                      borderLeft: `3px solid ${tx.accountColor}`,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tx.accountColor }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {tx.description}
                      {tx.recurringId && (
                        <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Recorrente" />
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {format(tx.date, "dd 'de' MMM", { locale: ptBR })}
                      {!accountId && ` · ${tx.accountName}`}
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
