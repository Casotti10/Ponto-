import { Wallet, TrendingUp, TrendingDown, History as HistoryIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccumulatedBalance, getDashboardData } from "@/lib/time-service";
import { minutesToHM } from "@/lib/time-calc";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AdjustmentFormDialog } from "@/components/balance/adjustment-form-dialog";
import { DeleteAdjustmentButton } from "@/components/balance/delete-adjustment-button";
import { CloseMonthButton } from "@/components/balance/close-month-button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { startOfYear } from "date-fns";

export default async function BancoHorasPage() {
  const user = await requireUser();
  const now = new Date();

  const [dashboard, yearBalance, adjustments, closures] = await Promise.all([
    getDashboardData(user.id, now),
    getAccumulatedBalance(user.id, startOfYear(now)),
    prisma.balanceAdjustment.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    prisma.monthlyClosure.findMany({ where: { userId: user.id }, orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 }),
  ]);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Wallet className="h-6 w-6" /> Banco de Horas
          </h1>
          <p className="text-muted-foreground">Acompanhe e ajuste manualmente seu saldo de horas.</p>
        </div>
        <div className="flex gap-2">
          <CloseMonthButton year={now.getFullYear()} month={now.getMonth() + 1} />
          <AdjustmentFormDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Saldo total acumulado"
          value={minutesToHM(dashboard.accumulatedBalance)}
          icon={Wallet}
          tone={dashboard.accumulatedBalance >= 0 ? "good" : "bad"}
          iconColor={dashboard.accumulatedBalance >= 0 ? "#2a78d6" : "#e34948"}
        />
        <StatCard
          label="Saldo do mês"
          value={minutesToHM(dashboard.monthBalance)}
          icon={dashboard.monthBalance >= 0 ? TrendingUp : TrendingDown}
          tone={dashboard.monthBalance >= 0 ? "good" : "bad"}
          iconColor={dashboard.monthBalance >= 0 ? "#1baf7a" : "#e34948"}
        />
        <StatCard
          label="Saldo do ano"
          value={minutesToHM(yearBalance)}
          icon={yearBalance >= 0 ? TrendingUp : TrendingDown}
          tone={yearBalance >= 0 ? "good" : "bad"}
          iconColor={yearBalance >= 0 ? "#1baf7a" : "#e34948"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de ajustes manuais</CardTitle>
          <CardDescription>Todo ajuste manual exige motivo e é registrado permanentemente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead className="hidden md:table-cell">Motivo</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Nenhum ajuste manual registrado
                    </TableCell>
                  </TableRow>
                )}
                {adjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell className="whitespace-nowrap">{format(adj.date, "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell>
                      <Badge variant={adj.minutes >= 0 ? "default" : "destructive"}>
                        {adj.minutes >= 0 ? "Crédito" : "Débito"}
                      </Badge>
                    </TableCell>
                    <TableCell className={adj.minutes >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                      {minutesToHM(adj.minutes)}
                    </TableCell>
                    <TableCell className="hidden max-w-[320px] truncate text-muted-foreground md:table-cell">{adj.reason}</TableCell>
                    <TableCell>
                      <DeleteAdjustmentButton id={adj.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4" /> Fechamentos mensais
          </CardTitle>
          <CardDescription>Registro histórico do saldo consolidado ao final de cada mês</CardDescription>
        </CardHeader>
        <CardContent>
          {closures.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum mês fechado ainda</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {closures.map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    {monthNames[c.month - 1]}/{c.year}
                  </p>
                  <p className={`text-lg font-semibold ${c.balanceMinutes >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {minutesToHM(c.balanceMinutes)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
