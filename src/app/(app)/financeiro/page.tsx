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
  CalendarX,
  AlertTriangle,
  Sparkles,
  Layers,
  FileUp,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canImportLedger } from "@/lib/import-access";
import { getMonthlyInsights, getMonthlyLedger } from "@/lib/ledger-service";
import {
  centsToBRL,
  centsToSignedBRL,
  formatLedgerDate,
  formatLedgerDay,
  ledgerDayToISO,
  MONTH_NAMES,
} from "@/lib/ledger-calc";
import { appDateString, appNow } from "@/lib/timezone";
import { ledgerColors } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LedgerModuleNav, LedgerViewTabs } from "@/components/ledger/ledger-view-tabs";
import { LedgerPeriodPicker } from "@/components/ledger/ledger-period-picker";
import { AccountFilter } from "@/components/ledger/account-filter";
import { MonthlySummary } from "@/components/ledger/monthly-summary";
import { TransactionFormDialog } from "@/components/ledger/transaction-form-dialog";
import { ImportStatementDialog } from "@/components/ledger/import-statement-dialog";
import { AdvancedEntryDialog } from "@/components/ledger/advanced-entry-dialog";
import { TransactionRowActions } from "@/components/ledger/transaction-row-actions";
import { CashflowChart, type CashflowPoint } from "@/components/ledger/cashflow-chart";
import { YearBalanceChart, type YearBalancePoint } from "@/components/ledger/year-balance-chart";
import { ExpensePieChart } from "@/components/ledger/expense-pie-chart";
import { CategoryBreakdown } from "@/components/ledger/category-breakdown";
import { AccountsManager } from "@/components/ledger/accounts-manager";
import { CategoriesManager } from "@/components/ledger/categories-manager";
import { RecurringManager } from "@/components/ledger/recurring-manager";
import { FinancialInsights } from "@/components/ledger/financial-insights";
import { FinancialExportButtons } from "@/components/ledger/ledger-export-buttons";
import type { ExportTable } from "@/lib/export-utils";

/**
 * VISÃO MENSAL do razão financeiro.
 *
 * O período vem da URL (?year=&month=) e vira cláusula `where` no Prisma. Cada
 * troca de mês é uma requisição nova a este Server Component e, portanto, uma
 * consulta nova ao banco: nada do mês anterior chega ao cliente para depois ser
 * escondido. O histórico completo mora na rota irmã /financeiro/geral.
 */
export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; accountId?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  // `appNow` e não `new Date()`: o servidor roda em UTC na Vercel, então às
  // 22h de 31/08 em São Paulo o relógio do processo já está em 01/09 e a tela
  // abriria em setembro para quem ainda está em agosto.
  const now = appNow();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const year = Number(params.year) || currentYear;
  const month = Math.min(12, Math.max(1, Number(params.month) || currentMonth));
  const accountId = params.accountId || null;

  const ledger = await getMonthlyLedger(user.id, year, month, accountId, now);
  const { totals, transactions, accounts, allAccounts, categories, recurrences } = ledger;

  const insights = await getMonthlyInsights(user.id, ledger, accountId);

  const activeAccounts = accounts.filter((a) => !a.archived);
  const accountOptions = allAccounts
    .filter((a) => !a.archived)
    .map((a) => ({ id: a.id, name: a.name }));

  // "Dinheiro em caixa" segue o filtro: com um banco selecionado, soma só ele.
  const totalCash = activeAccounts.reduce((acc, a) => acc + a.balanceCents, 0);

  // A importação de extrato é restrita por allowlist (ver `import-access.ts`),
  // e sem conta cadastrada não há destino possível para os lançamentos.
  const canImport = canImportLedger(user.email) && accountOptions.length > 0;

  const periodLabel = `${MONTH_NAMES[month - 1]} de ${year}`;
  const isCurrentPeriod = year === currentYear && month === currentMonth;

  // A data que o formulário assume ao abrir. No mês corrente é hoje; em
  // qualquer outro mês é o dia 1º DAQUELE mês — registrar com setembro na tela
  // tem que produzir um lançamento de setembro.
  const defaultDate = isCurrentPeriod
    ? appDateString(now)
    : `${year}-${String(month).padStart(2, "0")}-01`;

  const cashflowData: CashflowPoint[] = ledger.dailyFlow.map((point) => ({
    day: point.day,
    label: point.label,
    incomeCents: point.incomeCents,
    expenseCents: -point.expenseCents,
    runningCents: point.runningCents,
  }));

  const yearData: YearBalancePoint[] = ledger.yearSeries.map((point) => ({
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
      formatLedgerDate(tx.date),
      tx.description,
      tx.type === "ENTRADA" ? "Entrada" : "Saída",
      tx.categoryName ?? "Sem categoria",
      tx.accountName,
      `${tx.type === "ENTRADA" ? "" : "-"}${(tx.amountCents / 100).toFixed(2).replace(".", ",")}`,
    ]),
  };

  const isPositive = totals.balanceCents >= 0;
  const isEmpty = transactions.length === 0;

  const selectedAccount = accountId ? allAccounts.find((a) => a.id === accountId) : null;

  // O período viaja para a visão geral como `fromYear`/`fromMonth`, e não como
  // `year`/`month`: lá `year` é o FILTRO de ano, e a visão geral tem que abrir
  // mostrando tudo. Estes dois só existem para a viagem de volta.
  const overviewQuery = new URLSearchParams({
    fromYear: String(year),
    fromMonth: String(month),
  });
  if (accountId) overviewQuery.set("accountId", accountId);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Wallet className="h-6 w-6" /> Financeiro
          </h1>
          <p className="text-muted-foreground">
            Lançamentos de {periodLabel.toLowerCase()}
            {selectedAccount && ` · ${selectedAccount.name}`}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canImport && (
            <ImportStatementDialog
              accounts={accountOptions}
              trigger={<Button variant="outline" className="gap-1.5" />}
            >
              <FileUp className="h-4 w-4" /> Importar extrato
            </ImportStatementDialog>
          )}
          <AdvancedEntryDialog
            accounts={accountOptions}
            categories={categories}
            defaultDate={defaultDate}
            trigger={<Button variant="outline" className="gap-1.5" />}
          >
            <Layers className="h-4 w-4" /> Parcelar / transferir
          </AdvancedEntryDialog>
          <TransactionFormDialog
            accounts={accountOptions}
            categories={categories}
            defaultDate={defaultDate}
            trigger={<Button className="gap-1.5" />}
          >
            <Plus className="h-4 w-4" /> Novo lançamento
          </TransactionFormDialog>
        </div>
      </div>

      <LedgerModuleNav active="lancamentos" />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <LedgerViewTabs active="mensal" overviewHref={`/financeiro/geral?${overviewQuery}`} />
        <div className="flex flex-wrap items-center gap-2">
          <AccountFilter accounts={allAccounts} />
          <LedgerPeriodPicker
            year={year}
            month={month}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={`Entradas · ${MONTH_NAMES[month - 1]}`}
          value={centsToBRL(totals.incomeCents)}
          icon={ArrowUpRight}
          tone="good"
          iconColor={ledgerColors.light.income}
        />
        <StatCard
          label={`Saídas · ${MONTH_NAMES[month - 1]}`}
          value={centsToBRL(totals.expenseCents)}
          icon={ArrowDownRight}
          tone={totals.expenseCents > 0 ? "bad" : "neutral"}
          iconColor={ledgerColors.light.expense}
        />
        <StatCard
          label={`Saldo · ${MONTH_NAMES[month - 1]}`}
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
          hint={`${activeAccounts.length} conta(s) · só o liquidado`}
        />
      </div>

      {/* SEGUNDA LINHA — o previsto.
          Separada da primeira de propósito: em cima está o dinheiro que existe,
          aqui o que ainda vai acontecer. Misturar os dois é o que faz um app
          financeiro anunciar saldo que não está na conta. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="A receber"
          value={centsToBRL(totals.pendingIncomeCents)}
          icon={ArrowUpRight}
          tone={totals.pendingIncomeCents > 0 ? "good" : "neutral"}
          iconColor={ledgerColors.light.income}
          hint={
            totals.overdueIncomeCents > 0
              ? `${centsToBRL(totals.overdueIncomeCents)} em atraso`
              : "Nada em atraso"
          }
        />
        <StatCard
          label="A pagar"
          value={centsToBRL(totals.pendingExpenseCents)}
          icon={ArrowDownRight}
          tone={totals.pendingExpenseCents > 0 ? "warn" : "neutral"}
          iconColor={ledgerColors.light.expense}
          hint={
            totals.overdueExpenseCents > 0
              ? `${centsToBRL(totals.overdueExpenseCents)} vencido`
              : "Nada vencido"
          }
        />
        <StatCard
          label="Vencidos"
          value={centsToBRL(totals.overdueExpenseCents + totals.overdueIncomeCents)}
          icon={AlertTriangle}
          tone={totals.overdueExpenseCents + totals.overdueIncomeCents > 0 ? "bad" : "good"}
          iconColor={ledgerColors.light.expense}
          hint={
            totals.overdueExpenseCents + totals.overdueIncomeCents > 0
              ? "Passou da data de vencimento"
              : "Tudo em dia"
          }
        />
        <StatCard
          label="Saldo projetado"
          value={centsToSignedBRL(totalCash + totals.pendingIncomeCents - totals.pendingExpenseCents)}
          icon={Sparkles}
          tone={
            totalCash + totals.pendingIncomeCents - totals.pendingExpenseCents >= 0 ? "good" : "bad"
          }
          iconColor={ledgerColors.light.projection}
          hint="Caixa + a receber − a pagar"
        />
      </div>

      <FinancialInsights insights={insights} />

      {isEmpty && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarX className="h-8 w-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium">Nenhum lançamento em {periodLabel}</p>
            <p className="max-w-md text-xs text-muted-foreground">
              {selectedAccount
                ? `Não há movimentações de ${selectedAccount.name} neste período. Escolha outro banco, mude o mês ou registre a primeira.`
                : "Escolha outro mês no seletor acima ou registre a primeira movimentação deste período."}
            </p>
            <TransactionFormDialog
              accounts={accountOptions}
              categories={categories}
              defaultDate={defaultDate}
              trigger={<Button variant="outline" size="sm" className="mt-1 gap-1.5" />}
            >
              <Plus className="h-4 w-4" /> Lançar em {MONTH_NAMES[month - 1]}
            </TransactionFormDialog>
          </CardContent>
        </Card>
      )}

      {/* O resumo aparece sempre, inclusive zerado: ele descreve o mês
          selecionado, e "não houve movimento" também é uma resposta sobre ele. */}
      <MonthlySummary
        totals={totals}
        transactions={transactions}
        openingCents={ledger.openingCents}
        closingCents={ledger.closingCents}
        previousMonthBalance={ledger.previousNetCents}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" /> Para onde foi o dinheiro
            </CardTitle>
            <CardDescription>
              Proporção das saídas de {periodLabel.toLowerCase()} por categoria.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExpensePieChart items={ledger.expensesByCategory} monthLabel={periodLabel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>De onde veio o dinheiro</CardTitle>
            <CardDescription>Entradas do mês por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown
              items={ledger.incomeByCategory}
              emptyLabel={`Nenhuma entrada registrada em ${periodLabel.toLowerCase()}.`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Fluxo de caixa</CardTitle>
            <CardDescription>
              Entradas e saídas por dia, com o saldo acumulado partindo de{" "}
              {centsToBRL(ledger.openingCents)} — quanto você já tinha no começo do mês.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CashflowChart data={cashflowData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maior gasto</CardTitle>
            <CardDescription>De {periodLabel.toLowerCase()}</CardDescription>
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
            <CardTitle>Lançamentos de {periodLabel}</CardTitle>
            <CardDescription>
              {totals.transactionCount} lançamento(s) neste período
            </CardDescription>
          </div>
          <FinancialExportButtons
            table={exportTable}
            filename={`financeiro-${year}-${String(month).padStart(2, "0")}`}
            title={`Lançamentos — ${periodLabel}`}
          />
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarX className="h-8 w-8 text-muted-foreground/50" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento em {periodLabel}.
              </p>
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
                      {formatLedgerDay(tx.date)}
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
                      date: ledgerDayToISO(tx.date),
                      description: tx.description,
                      amount: (tx.amountCents / 100).toFixed(2).replace(".", ","),
                      type: tx.type,
                      accountId: tx.accountId,
                      categoryId: tx.categoryId,
                      notes: tx.notes,
                      // Sem estes dois, editar um lançamento pendente o
                      // rebaixaria a liquidado ao salvar — o formulário cai
                      // no padrão quando não recebe a situação atual.
                      status: tx.status,
                      dueDate: tx.dueDate ? ledgerDayToISO(tx.dueDate) : null,
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
            {/* Sempre todas as contas: o filtro de banco recorta o que se está
                analisando, não o que se pode administrar. */}
            <AccountsManager accounts={allAccounts} />
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
        Ponto+ · Controle financeiro pessoal · {currentYear}
      </p>
    </div>
  );
}
