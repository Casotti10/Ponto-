import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  computeDayResult,
  type DayResult,
  type WorkScheduleLike,
} from "@/lib/time-calc";
import {
  startOfDay,
  endOfDay,
  isBefore,
  isSameDay,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
} from "date-fns";
import { appNow, appToday } from "@/lib/timezone";

const DEFAULT_SCHEDULE: WorkScheduleLike = {
  dailyHours: 8,
  weeklyHours: 40,
  lunchBreakMinutes: 60,
  toleranceMinutes: 10,
  workDays: [1, 2, 3, 4, 5],
};

export async function getOrCreateWorkSchedule(userId: string) {
  // A dashboard dispara múltiplas chamadas em paralelo para o mesmo usuário
  // recém-criado (sem WorkSchedule ainda). Mesmo com upsert, duas transações
  // concorrentes podem colidir na criação (P2002) — nesse caso, a que perdeu
  // a corrida apenas busca a linha que a outra acabou de inserir.
  try {
    return await prisma.workSchedule.upsert({
      where: { userId },
      create: { userId, ...DEFAULT_SCHEDULE },
      update: {},
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return prisma.workSchedule.findUniqueOrThrow({ where: { userId } });
    }
    throw err;
  }
}

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export interface DailyReport extends DayResult {
  date: Date;
  entries: { id: string; type: string; time: Date; notes: string | null }[];
  absenceId?: string;
}

export async function getDayResultsForRange(
  userId: string,
  start: Date,
  end: Date
): Promise<DailyReport[]> {
  const schedule = await getOrCreateWorkSchedule(userId);
  // Precisa ser o mesmo relógio de parede gravado nas batidas: `now` é
  // subtraído do último registro para contar o dia em andamento, e um `now` em
  // outro fuso somaria o offset inteiro às horas trabalhadas de hoje.
  const now = appNow();
  const today = startOfDay(now);

  const [entries, absences] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId, date: { gte: startOfDay(start), lte: endOfDay(end) } },
      orderBy: { time: "asc" },
    }),
    prisma.absence.findMany({
      where: {
        userId,
        date: { lte: endOfDay(end) },
        OR: [{ endDate: { gte: startOfDay(start) } }, { endDate: null, date: { gte: startOfDay(start) } }],
      },
    }),
  ]);

  const entriesByDay = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = dateKey(e.date);
    if (!entriesByDay.has(key)) entriesByDay.set(key, []);
    entriesByDay.get(key)!.push(e);
  }

  const results: DailyReport[] = [];
  let cursor = startOfDay(start);
  const finalDay = startOfDay(end);

  while (!isBefore(finalDay, cursor)) {
    const key = dateKey(cursor);
    const dayEntries = entriesByDay.get(key) ?? [];
    const absence = absences.find((a) => {
      const from = startOfDay(a.date);
      const to = a.endDate ? endOfDay(a.endDate) : endOfDay(a.date);
      return !isBefore(cursor, from) && !isBefore(to, cursor);
    });

    const isPast = isBefore(cursor, today);
    const isToday = isSameDay(cursor, today);

    const result = computeDayResult({
      date: cursor,
      entries: dayEntries.map((e) => ({ type: e.type, time: e.time })),
      absence: absence ? { type: absence.type, hours: absence.hours } : null,
      schedule,
      isPast,
      isToday,
      now,
    });

    results.push({
      ...result,
      date: cursor,
      entries: dayEntries.map((e) => ({ id: e.id, type: e.type, time: e.time, notes: e.notes })),
      absenceId: absence?.id,
    });

    cursor = addDays(cursor, 1);
  }

  return results;
}

export interface RangeSummary {
  workedMinutes: number;
  expectedMinutes: number;
  extraMinutes: number;
  negativeMinutes: number;
  balanceDeltaMinutes: number;
  diasTrabalhados: number;
  diasFalta: number;
  diasFerias: number;
  diasFolga: number;
  diasHomeOffice: number;
  diasIncompletos: number;
}

export function summarizeDayResults(days: DailyReport[]): RangeSummary {
  const summary: RangeSummary = {
    workedMinutes: 0,
    expectedMinutes: 0,
    extraMinutes: 0,
    negativeMinutes: 0,
    balanceDeltaMinutes: 0,
    diasTrabalhados: 0,
    diasFalta: 0,
    diasFerias: 0,
    diasFolga: 0,
    diasHomeOffice: 0,
    diasIncompletos: 0,
  };

  for (const day of days) {
    summary.workedMinutes += day.workedMinutes;
    summary.expectedMinutes += day.expectedMinutes;
    summary.extraMinutes += day.extraMinutes;
    summary.negativeMinutes += day.negativeMinutes;
    summary.balanceDeltaMinutes += day.balanceDeltaMinutes;

    switch (day.status) {
      case "COMPLETO":
      case "HORA_EXTRA":
      case "TRABALHO_FOLGA":
      case "HOME_OFFICE":
        summary.diasTrabalhados += 1;
        if (day.status === "HOME_OFFICE") summary.diasHomeOffice += 1;
        break;
      case "FALTA_INJUSTIFICADA":
      case "FALTA_JUSTIFICADA":
      case "FALTA_NAO_REGISTRADA":
        summary.diasFalta += 1;
        break;
      case "FERIAS":
        summary.diasFerias += 1;
        break;
      case "FOLGA":
        summary.diasFolga += 1;
        break;
      case "INCOMPLETO":
        summary.diasIncompletos += 1;
        break;
    }
  }

  return summary;
}

export async function getAccumulatedBalance(userId: string, uptoDate: Date): Promise<number> {
  const firstEntry = await prisma.timeEntry.findFirst({
    where: { userId },
    orderBy: { date: "asc" },
  });
  const firstAbsence = await prisma.absence.findFirst({
    where: { userId },
    orderBy: { date: "asc" },
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const candidates = [firstEntry?.date, firstAbsence?.date, user?.createdAt].filter(
    (d): d is Date => !!d
  );
  if (candidates.length === 0) return 0;

  const start = candidates.reduce((min, d) => (isBefore(d, min) ? d : min));

  const days = await getDayResultsForRange(userId, start, uptoDate);
  const summary = summarizeDayResults(days);

  const adjustments = await prisma.balanceAdjustment.aggregate({
    where: { userId, date: { lte: endOfDay(uptoDate) } },
    _sum: { minutes: true },
  });

  return summary.balanceDeltaMinutes + (adjustments._sum.minutes ?? 0);
}

export async function getDashboardData(userId: string, referenceDate: Date = appNow()) {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const yearStart = startOfYear(referenceDate);
  const yearEnd = endOfYear(referenceDate);

  const [monthDays, yearDays, accumulatedBalance] = await Promise.all([
    getDayResultsForRange(userId, monthStart, monthEnd),
    getDayResultsForRange(userId, yearStart, yearEnd),
    getAccumulatedBalance(userId, referenceDate),
  ]);

  const monthSummary = summarizeDayResults(monthDays);
  const yearSummary = summarizeDayResults(yearDays.filter((d) => !isBefore(referenceDate, d.date)));

  const monthAdjustments = await prisma.balanceAdjustment.aggregate({
    where: { userId, date: { gte: monthStart, lte: monthEnd } },
    _sum: { minutes: true },
  });

  return {
    monthDays,
    monthSummary,
    yearSummary,
    accumulatedBalance,
    monthBalance: monthSummary.balanceDeltaMinutes + (monthAdjustments._sum.minutes ?? 0),
  };
}

export async function getBalanceTrend(userId: string, days = 90) {
  const end = appToday();
  const start = addDays(end, -days + 1);

  const balanceAtStart = await getAccumulatedBalance(userId, addDays(start, -1));
  const dayResults = await getDayResultsForRange(userId, start, end);

  const adjustments = await prisma.balanceAdjustment.findMany({
    where: { userId, date: { gte: start, lte: endOfDay(end) } },
  });
  const adjustmentsByDay = new Map<string, number>();
  for (const adj of adjustments) {
    const key = dateKey(adj.date);
    adjustmentsByDay.set(key, (adjustmentsByDay.get(key) ?? 0) + adj.minutes);
  }

  let running = balanceAtStart;
  return dayResults.map((day) => {
    running += day.balanceDeltaMinutes + (adjustmentsByDay.get(dateKey(day.date)) ?? 0);
    return {
      label: format(day.date, "dd/MM"),
      balance: running,
    };
  });
}

export async function closeMonth(userId: string, year: number, month: number) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = endOfMonth(monthStart);
  const days = await getDayResultsForRange(userId, monthStart, monthEnd);
  const summary = summarizeDayResults(days);
  const balanceMinutes = await getAccumulatedBalance(userId, monthEnd);

  const closure = await prisma.monthlyClosure.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: {
      userId,
      year,
      month,
      balanceMinutes,
      workedMinutes: summary.workedMinutes,
      expectedMinutes: summary.expectedMinutes,
      extraMinutes: summary.extraMinutes,
      negativeMinutes: summary.negativeMinutes,
    },
    update: {
      balanceMinutes,
      workedMinutes: summary.workedMinutes,
      expectedMinutes: summary.expectedMinutes,
      extraMinutes: summary.extraMinutes,
      negativeMinutes: summary.negativeMinutes,
      closedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      entity: "BALANCE_ADJUSTMENT",
      entityId: closure.id,
      action: "CLOSE_MONTH",
      after: { year, month, balanceMinutes },
      reason: `Fechamento do mês ${month}/${year}`,
    },
  });

  return closure;
}
