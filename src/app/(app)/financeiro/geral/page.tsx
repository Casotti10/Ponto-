import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  Hash,
  Repeat,
  SearchX,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getLedgerHistory, HISTORY_PAGE_SIZE } from "@/lib/ledger-service";
import {
  centsToBRL,
  centsToSignedBRL,
  formatLedgerDate,
  ledgerMonthOf,
  MONTH_NAMES,
} from "@/lib/ledger-calc";
import { appNow } from "@/lib/timezone";
import { ledgerColors } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LedgerViewTabs } from "@/components/ledger/ledger-view-tabs";
import { HistoryFilters } from "@/components/ledger/history-filters";
import { HistoryPagination } from "@/components/ledger/history-pagination";
import { FinancialExportButtons } from "@/components/ledger/ledger-export-buttons";
import type { ExportTable } from "@/lib/export-utils";

/**
 * VISÃO GERAL do razão financeiro — todo o histórico, sem recorte de mês.
 *
 * É uma rota separada de /financeiro de propósito. As duas telas respondem a
 * perguntas diferentes e, por isso, fazem consultas diferentes: aqui não existe
 * `year`/`month` obrigatório, existe paginação, e os totais somam o conjunto
 * filtrado inteiro. Nenhuma das duas reaproveita os dados da outra.
 */
export default async function FinanceiroGeralPage({
  searchParams,
}: {
  searchParams: Promise<{
    /** Filtro de ano desta tela. Ausente = todos os anos, que é o padrão. */
    year?: string;
    accountId?: string;
    categoryId?: string;
    type?: string;
    q?: string;
    page?: string;
    /** Período de onde o usuário veio, só para a viagem de volta à visão mensal. */
    fromYear?: string;
    fromMonth?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = appNow();

  const parsedYear = Number(params.year);
  const type = params.type === "ENTRADA" || params.type === "SAIDA" ? params.type : null;

  const history = await getLedgerHistory(user.id, {
    year: Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : null,
    accountId: params.accountId || null,
    categoryId: params.categoryId || null,
    type,
    search: params.q?.trim() || null,
    page: Number(params.page) || 1,
    pageSize: HISTORY_PAGE_SIZE,
  });

  const { totals, transactions, months } = history;
  const isPositive = totals.balanceCents >= 0;
  const isEmpty = totals.transactionCount === 0;

  // Volta para a visão mensal no mês em que o usuário estava. `fromYear` e
  // `fromMonth` viajam separados de `year` justamente para que abrir a visão
  // geral não a deixe pré-filtrada pelo mês de origem.
  const backQuery = new URLSearchParams();
  if (params.fromYear) backQuery.set("year", params.fromYear);
  if (params.fromMonth) backQuery.set("month", params.fromMonth);
  if (params.accountId) backQuery.set("accountId", params.accountId);
  const monthlyHref = backQuery.toString() ? `/financeiro?${backQuery}` : "/financeiro";

  const exportTable: ExportTable = {
    sheetName: "Histórico",
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

  // A lista paginada é quebrada em blocos por mês: o histórico é longo, e saber
  // em que mês se está lendo é o que impede a lista de virar um borrão. O
  // agrupamento acontece aqui, antes do JSX, para a renderização continuar
  // sendo uma função pura do resultado da consulta.
  const pageGroups: { key: string; label: string; items: typeof transactions }[] = [];
  for (const tx of transactions) {
    const { year: txYear, month: txMonth } = ledgerMonthOf(tx.date);
    const key = `${txYear}-${txMonth}`;
    const last = pageGroups.at(-1);
    if (last?.key === key) last.items.push(tx);
    else pageGroups.push({ key, label: `${MONTH_NAMES[txMonth - 1]} de ${txYear}`, items: [tx] });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Wallet className="h-6 w-6" /> Financeiro
        </h1>
        <p className="text-muted-foreground">
          Todo o histórico de lançamentos, independentemente do mês.
        </p>
      </div>

      <LedgerViewTabs active="geral" monthlyHref={monthlyHref} />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Recorte o histórico por ano, tipo, banco, categoria ou descrição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HistoryFilters
            accounts={history.accounts}
            categories={history.categories}
            availableYears={history.availableYears}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total de entradas"
          value={centsToBRL(totals.incomeCents)}
          icon={ArrowUpRight}
          tone="good"
          iconColor={ledgerColors.light.income}
          hint="No período filtrado"
        />
        <StatCard
          label="Total de saídas"
          value={centsToBRL(totals.expenseCents)}
          icon={ArrowDownRight}
          tone={totals.expenseCents > 0 ? "bad" : "neutral"}
          iconColor={ledgerColors.light.expense}
          hint="No período filtrado"
        />
        <StatCard
          label="Saldo acumulado"
          value={centsToSignedBRL(totals.balanceCents)}
          icon={isPositive ? TrendingUp : TrendingDown}
          tone={isPositive ? "good" : "bad"}
          iconColor={isPositive ? ledgerColors.light.income : ledgerColors.light.expense}
          hint={totals.incomeCents > 0 ? `Sobrou ${totals.savingsRate}% do que entrou` : "Sem entradas"}
        />
        <StatCard
          label="Lançamentos"
          value={String(totals.transactionCount)}
          icon={Hash}
          tone="neutral"
          iconColor={ledgerColors.light.balance}
          hint={
            history.firstDate && history.lastDate
              ? `${formatLedgerDate(history.firstDate)} a ${formatLedgerDate(history.lastDate)}`
              : "Nenhum registro"
          }
        />
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium">Nenhum lançamento encontrado</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Nenhum registro atende a esses filtros. Limpe os filtros acima para ver o histórico
              completo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Resumo por mês</CardTitle>
              <CardDescription>
                {months.length} mês(es) com movimentação. Clique para abrir a visão mensal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 divide-y overflow-auto rounded-lg border">
                {months.map((row) => {
                  const rowPositive = row.balanceCents >= 0;
                  return (
                    <Link
                      key={`${row.year}-${row.month}`}
                      href={`/financeiro?year=${row.year}&month=${row.month}${
                        params.accountId ? `&accountId=${params.accountId}` : ""
                      }`}
                      className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.transactionCount} lançamento(s)
                        </p>
                      </div>

                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-xs text-emerald-600 tabular-nums dark:text-emerald-400">
                          +{centsToBRL(row.incomeCents)}
                        </p>
                        <p className="text-xs text-red-600 tabular-nums dark:text-red-400">
                          −{centsToBRL(row.expenseCents)}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "w-32 shrink-0 text-right text-sm font-semibold tabular-nums",
                          rowPositive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {centsToSignedBRL(row.balanceCents)}
                      </span>

                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Todos os lançamentos</CardTitle>
                <CardDescription>
                  Do mais recente para o mais antigo, em ordem cronológica.
                </CardDescription>
              </div>
              <FinancialExportButtons
                table={exportTable}
                filename={`financeiro-historico-pagina-${history.page}`}
                title="Histórico de lançamentos"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="divide-y rounded-lg border">
                {pageGroups.map((group) => (
                  <div key={group.key}>
                    <p className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="divide-y">
                      {group.items.map((tx) => (
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
                                <Repeat
                                  className="h-3 w-3 shrink-0 text-muted-foreground"
                                  aria-label="Recorrente"
                                />
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatLedgerDate(tx.date)} · {tx.accountName}
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
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <HistoryPagination
                page={history.page}
                pageCount={history.pageCount}
                totalCount={history.totalCount}
                pageSize={history.pageSize}
              />
            </CardContent>
          </Card>
        </>
      )}

      <p className="pb-6 text-center text-xs text-muted-foreground">
        Ponto+ · Controle financeiro pessoal · {now.getFullYear()}
      </p>
    </div>
  );
}
