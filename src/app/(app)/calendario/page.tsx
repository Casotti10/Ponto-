import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { getDayResultsForRange } from "@/lib/time-service";
import { appNow } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MonthCalendar, type CalendarDay } from "@/components/calendar/month-calendar";
import { cn } from "@/lib/utils";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const TYPE_LABELS: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA_ALMOCO: "Saída almoço",
  RETORNO_ALMOCO: "Retorno almoço",
  SAIDA: "Saída",
};

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = appNow();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const reference = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const dayResults = await getDayResultsForRange(user.id, gridStart, gridEnd);

  const days: CalendarDay[] = dayResults.map((d) => ({
    dateIso: d.date.toISOString(),
    dayNumber: d.date.getDate(),
    isCurrentMonth: d.date.getMonth() === reference.getMonth(),
    status: d.status,
    workedMinutes: d.workedMinutes,
    extraMinutes: d.extraMinutes,
    negativeMinutes: d.negativeMinutes,
    balanceDeltaMinutes: d.balanceDeltaMinutes,
    entries: d.entries.map((e) => ({ type: TYPE_LABELS[e.type] ?? e.type, time: format(e.time, "HH:mm") })),
  }));

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CalendarDays className="h-6 w-6" /> Calendário
        </h1>
        <p className="text-muted-foreground">Visão mensal de dias trabalhados, faltas, férias e horas extras.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">
            {monthNames[reference.getMonth()]} {reference.getFullYear()}
          </CardTitle>
          <div className="flex gap-1">
            <Link
              href={`/calendario?year=${prevMonth.year}&month=${prevMonth.month}`}
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-8 w-8")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={`/calendario?year=${now.getFullYear()}&month=${now.getMonth() + 1}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Hoje
            </Link>
            <Link
              href={`/calendario?year=${nextMonth.year}&month=${nextMonth.month}`}
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-8 w-8")}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <MonthCalendar days={days} />
        </CardContent>
      </Card>
    </div>
  );
}
