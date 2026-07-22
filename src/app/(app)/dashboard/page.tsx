import {
  Clock,
  TrendingUp,
  TrendingDown,
  CalendarCheck,
  CalendarX,
  Palmtree,
  CoffeeIcon,
  Target,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDashboardData, getBalanceTrend } from "@/lib/time-service";
import { minutesToHM } from "@/lib/time-calc";
import { StatCard } from "@/components/dashboard/stat-card";
import { QuickPunch } from "@/components/timeentry/quick-punch";
import { DailyBalanceChart, type DailyBalancePoint } from "@/components/dashboard/daily-balance-chart";
import { BalanceTrendChart } from "@/components/dashboard/balance-trend-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();

  const [dashboard, trend, goals] = await Promise.all([
    getDashboardData(user.id, now),
    getBalanceTrend(user.id, 90),
    prisma.goal.findMany({
      where: { userId: user.id, year: now.getFullYear(), month: now.getMonth() + 1 },
    }),
  ]);

  const todayEntries = dashboard.monthDays.find((d) => d.date.toDateString() === now.toDateString());
  const todayTypes = (todayEntries?.entries ?? []).map((e) => e.type as import("@prisma/client").EntryType);

  const dailyBalanceData: DailyBalancePoint[] = dashboard.monthDays
    .filter((d) => d.status !== "FUTURO")
    .map((d) => ({
      day: d.date.getDate().toString(),
      minutes: d.balanceDeltaMinutes,
      status: d.status,
    }));

  const { monthSummary, yearSummary, accumulatedBalance, monthBalance } = dashboard;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {user.name.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground">
          {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <QuickPunch todayEntryTypes={todayTypes} />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatCard
            label="Saldo do banco de horas"
            value={minutesToHM(accumulatedBalance)}
            icon={Wallet}
            tone={accumulatedBalance >= 0 ? "good" : "bad"}
            iconColor={accumulatedBalance >= 0 ? "#2a78d6" : "#e34948"}
            hint="Saldo acumulado total"
          />
          <StatCard
            label="Saldo do mês"
            value={minutesToHM(monthBalance)}
            icon={monthBalance >= 0 ? TrendingUp : TrendingDown}
            tone={monthBalance >= 0 ? "good" : "bad"}
            iconColor={monthBalance >= 0 ? "#1baf7a" : "#e34948"}
            hint={monthNames[now.getMonth()]}
          />
          <StatCard
            label="Horas extras (mês)"
            value={minutesToHM(monthSummary.extraMinutes)}
            icon={Clock}
            iconColor="#eda100"
            hint="Acima da jornada prevista"
          />
          <StatCard
            label="Horas faltantes (mês)"
            value={minutesToHM(monthSummary.negativeMinutes)}
            icon={Clock}
            iconColor="#e34948"
            hint="Abaixo da jornada prevista"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Dias trabalhados" value={`${monthSummary.diasTrabalhados}`} icon={CalendarCheck} iconColor="#1baf7a" />
        <StatCard label="Dias de falta" value={`${monthSummary.diasFalta}`} icon={CalendarX} iconColor="#e34948" />
        <StatCard label="Dias de férias" value={`${monthSummary.diasFerias}`} icon={Palmtree} iconColor="#4a3aa7" />
        <StatCard label="Dias de folga" value={`${monthSummary.diasFolga}`} icon={CoffeeIcon} iconColor="#e87ba4" />
        <StatCard label="Home office" value={`${monthSummary.diasHomeOffice}`} icon={Target} iconColor="#eda100" />
        <StatCard label="Horas no ano" value={minutesToHM(yearSummary.workedMinutes)} icon={Clock} iconColor="#2a78d6" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Saldo diário do mês</CardTitle>
            <CardDescription>Diferença entre horas trabalhadas e jornada prevista, por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyBalanceChart data={dailyBalanceData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução do saldo acumulado</CardTitle>
            <CardDescription>Últimos 90 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <BalanceTrendChart data={trend} />
          </CardContent>
        </Card>
      </div>

      {goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" /> Metas do mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.map((goal) => {
              const workedHours = monthSummary.workedMinutes / 60;
              const pct = Math.min(100, Math.round((workedHours / goal.targetHours) * 100));
              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{goal.title}</span>
                    <Badge variant={pct >= 100 ? "default" : "secondary"}>
                      {workedHours.toFixed(1)}h / {goal.targetHours}h
                    </Badge>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
