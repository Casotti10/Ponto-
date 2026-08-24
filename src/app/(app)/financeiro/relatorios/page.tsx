import Link from "next/link";
import { FileBarChart2, TrendingDown, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getYearReport } from "@/lib/ledger-service";
import { centsToBRL, centsToSignedBRL, MONTH_NAMES } from "@/lib/ledger-calc";
import { appNow } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LedgerModuleNav } from "@/components/ledger/ledger-view-tabs";
import { FinancialExportButtons } from "@/components/ledger/ledger-export-buttons";
import type { ExportTable } from "@/lib/export-utils";

/**
 * RELATÓRIOS do ano.
 *
 * Três perguntas, três tabelas: como o ano se comportou mês a mês, para onde o
 * dinheiro foi, e de onde ele veio. Cada uma exportável em CSV, Excel e PDF
 * reaproveitando `export-utils`.
 *
 * "Resumo de resultado" e não "DRE": o conteúdo é o mesmo — receita, despesa,
 * resultado e margem — mas o nome contábil não ajuda quem está controlando a
 * própria vida financeira.
 */
export default async function RelatoriosFinanceirosPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const now = appNow();
  const currentYear = now.getFullYear();
  const year = Number(params.year) || currentYear;

  const report = await getYearReport(user.id, year);
  const { totals } = report;

  const positivo = totals.balanceCents >= 0;

  const mensalTable: ExportTable = {
    sheetName: `Mensal ${year}`,
    headers: ["Mês", "Receitas", "Despesas", "Resultado", "Caixa acumulado"],
    rows: report.months.map((m) => [
      MONTH_NAMES[m.month - 1],
      (m.incomeCents / 100).toFixed(2).replace(".", ","),
      (m.expenseCents / 100).toFixed(2).replace(".", ","),
      (m.balanceCents / 100).toFixed(2).replace(".", ","),
      (m.accumulatedCents / 100).toFixed(2).replace(".", ","),
    ]),
  };

  const despesasTable: ExportTable = {
    sheetName: `Despesas ${year}`,
    headers: ["Categoria", "Total", "% do total", "Lançamentos"],
    rows: report.expensesByCategory.map((c) => [
      c.name,
      (c.totalCents / 100).toFixed(2).replace(".", ","),
      `${c.percent}%`,
      String(c.transactionCount),
    ]),
  };

  const receitasTable: ExportTable = {
    sheetName: `Receitas ${year}`,
    headers: ["Categoria", "Total", "% do total", "Lançamentos"],
    rows: report.incomeByCategory.map((c) => [
      c.name,
      (c.totalCents / 100).toFixed(2).replace(".", ","),
      `${c.percent}%`,
      String(c.transactionCount),
    ]),
  };

  const semDados = totals.incomeCents === 0 && totals.expenseCents === 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileBarChart2 className="h-6 w-6" /> Relatórios
          </h1>
          <p className="text-muted-foreground">Consolidado de {year}, mês a mês e por categoria.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/financeiro/relatorios?year=${year - 1}`} />}
          >
            {year - 1}
          </Button>
          <span className="px-2 text-sm font-medium tabular-nums">{year}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={year >= currentYear}
            render={
              year < currentYear ? (
                <Link href={`/financeiro/relatorios?year=${year + 1}`} />
              ) : undefined
            }
          >
            {year + 1}
          </Button>
        </div>
      </div>

      <LedgerModuleNav active="relatorios" />

      {semDados ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">Nenhum lançamento liquidado em {year}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Os relatórios consideram só o que foi efetivamente pago ou recebido.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo de resultado · {year}</CardTitle>
              <CardDescription>Só o que foi efetivamente pago ou recebido.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Receitas</dt>
                  <dd className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-500">
                    {centsToBRL(totals.incomeCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">(−) Despesas</dt>
                  <dd className="text-lg font-semibold tabular-nums text-red-600 dark:text-red-500">
                    {centsToBRL(totals.expenseCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">(=) Resultado</dt>
                  <dd
                    className={cn(
                      "flex items-center gap-1 text-lg font-semibold tabular-nums",
                      positivo
                        ? "text-emerald-600 dark:text-emerald-500"
                        : "text-red-600 dark:text-red-500"
                    )}
                  >
                    {positivo ? (
                      <TrendingUp className="h-4 w-4" aria-hidden />
                    ) : (
                      <TrendingDown className="h-4 w-4" aria-hidden />
                    )}
                    {centsToSignedBRL(totals.balanceCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Margem</dt>
                  <dd className="text-lg font-semibold tabular-nums">{report.marginPercent}%</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <ReportTable
            title={`Evolução mensal · ${year}`}
            description="Resultado de cada mês e o caixa acumulado ao fim dele."
            table={mensalTable}
            filename={`financeiro-mensal-${year}`}
            headers={["Mês", "Receitas", "Despesas", "Resultado", "Caixa acumulado"]}
            rows={report.months.map((m) => ({
              key: String(m.month),
              cells: [
                MONTH_NAMES[m.month - 1],
                centsToBRL(m.incomeCents),
                centsToBRL(m.expenseCents),
                centsToSignedBRL(m.balanceCents),
                centsToSignedBRL(m.accumulatedCents),
              ],
              highlight: m.balanceCents < 0,
            }))}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <ReportTable
              title="Despesas por categoria"
              description={`Para onde o dinheiro foi em ${year}.`}
              table={despesasTable}
              filename={`financeiro-despesas-${year}`}
              headers={["Categoria", "Total", "%"]}
              rows={report.expensesByCategory.map((c) => ({
                key: c.categoryId ?? "sem",
                cells: [c.name, centsToBRL(c.totalCents), `${c.percent}%`],
                color: c.color,
              }))}
            />
            <ReportTable
              title="Receitas por categoria"
              description={`De onde o dinheiro veio em ${year}.`}
              table={receitasTable}
              filename={`financeiro-receitas-${year}`}
              headers={["Categoria", "Total", "%"]}
              rows={report.incomeByCategory.map((c) => ({
                key: c.categoryId ?? "sem",
                cells: [c.name, centsToBRL(c.totalCents), `${c.percent}%`],
                color: c.color,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ReportTable({
  title,
  description,
  table,
  filename,
  headers,
  rows,
}: {
  title: string;
  description: string;
  table: ExportTable;
  filename: string;
  headers: string[];
  rows: { key: string; cells: string[]; color?: string; highlight?: boolean }[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <FinancialExportButtons table={table} filename={filename} title={title} />
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">Nada a mostrar neste recorte.</p>
        ) : (
          /* Tabela larga rola dentro do próprio container: a página nunca rola
             na horizontal, que é o que quebra a leitura no celular. */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  {headers.map((h, i) => (
                    <th
                      key={h}
                      className={cn("pb-2 font-medium", i === 0 ? "text-left" : "text-right")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.key}>
                    {row.cells.map((cell, i) => (
                      <td
                        key={i}
                        className={cn(
                          "py-1.5",
                          i === 0 ? "text-left" : "text-right tabular-nums",
                          row.highlight && i > 0 && "text-red-600 dark:text-red-500"
                        )}
                      >
                        {i === 0 && row.color && (
                          <span
                            className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                            style={{ backgroundColor: row.color }}
                            aria-hidden
                          />
                        )}
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
