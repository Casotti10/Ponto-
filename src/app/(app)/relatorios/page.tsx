import { FileBarChart2 } from "lucide-react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { requireUser } from "@/lib/auth";
import { getDayResultsForRange, summarizeDayResults } from "@/lib/time-service";
import { appNow } from "@/lib/timezone";
import { minutesToHM } from "@/lib/time-calc";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReportRangePicker } from "@/components/reports/report-range-picker";
import { ExportButtons } from "@/components/reports/export-buttons";
import { buildReportRows } from "@/lib/export-utils";
import { Clock, TrendingUp, TrendingDown, CalendarX } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function resolveRange(range: string, startParam?: string, endParam?: string) {
  const now = appNow();
  switch (range) {
    case "day":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return { start: startOfWeek(now), end: endOfWeek(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "custom":
      return {
        start: startParam ? startOfDay(new Date(`${startParam}T00:00:00`)) : startOfMonth(now),
        end: endParam ? endOfDay(new Date(`${endParam}T00:00:00`)) : endOfMonth(now),
      };
    case "month":
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const range = params.range ?? "month";
  const { start, end } = resolveRange(range, params.start, params.end);

  const days = await getDayResultsForRange(user.id, start, end);
  const summary = summarizeDayResults(days);
  const rows = buildReportRows(days);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileBarChart2 className="h-6 w-6" /> Relatórios
        </h1>
        <p className="text-muted-foreground">
          Período: {format(start, "dd/MM/yyyy", { locale: ptBR })} a {format(end, "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ReportRangePicker range={range} start={params.start ?? format(start, "yyyy-MM-dd")} end={params.end ?? format(end, "yyyy-MM-dd")} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total trabalhado" value={minutesToHM(summary.workedMinutes)} icon={Clock} iconColor="#2a78d6" />
        <StatCard label="Horas extras" value={minutesToHM(summary.extraMinutes)} icon={TrendingUp} iconColor="#1baf7a" />
        <StatCard label="Horas negativas" value={minutesToHM(summary.negativeMinutes)} icon={TrendingDown} iconColor="#e34948" />
        <StatCard label="Faltas" value={`${summary.diasFalta}`} icon={CalendarX} iconColor="#e34948" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Detalhamento diário</CardTitle>
          <ExportButtons rows={rows} filename={`relatorio-ponto-${range}`} title="Relatório de Ponto e Banco de Horas" />
        </CardHeader>
        <CardContent>
          <div className="max-h-[520px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trabalhado</TableHead>
                  <TableHead className="hidden sm:table-cell">Previsto</TableHead>
                  <TableHead className="hidden sm:table-cell">Extra</TableHead>
                  <TableHead className="hidden sm:table-cell">Negativo</TableHead>
                  <TableHead>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.status}</Badge>
                    </TableCell>
                    <TableCell>{row.worked}</TableCell>
                    <TableCell className="hidden sm:table-cell">{row.expected}</TableCell>
                    <TableCell className="hidden text-emerald-600 dark:text-emerald-400 sm:table-cell">{row.extra}</TableCell>
                    <TableCell className="hidden text-red-600 dark:text-red-400 sm:table-cell">{row.negative}</TableCell>
                    <TableCell className="font-medium">{row.balance}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
