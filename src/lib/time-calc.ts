import type { AbsenceType, EntryType } from "@prisma/client";

export interface EntryLike {
  type: EntryType;
  time: Date;
}

export interface AbsenceLike {
  type: AbsenceType;
  hours: number | null;
}

export interface WorkScheduleLike {
  dailyHours: number;
  weeklyHours: number;
  lunchBreakMinutes: number;
  toleranceMinutes: number;
  workDays: number[];
}

export type DayStatus =
  | "COMPLETO"
  | "HORA_EXTRA"
  | "INCOMPLETO"
  | "FALTA_NAO_REGISTRADA"
  | "FALTA_JUSTIFICADA"
  | "FALTA_INJUSTIFICADA"
  | "FERIAS"
  | "LICENCA"
  | "FOLGA"
  | "BANCO_HORAS"
  | "COMPENSACAO"
  | "HOME_OFFICE"
  | "TRABALHO_FOLGA"
  | "FOLGA_PADRAO"
  | "FUTURO"
  | "EM_ANDAMENTO";

export interface DayResult {
  isScheduledWorkday: boolean;
  expectedMinutes: number;
  workedMinutes: number;
  extraMinutes: number;
  negativeMinutes: number;
  balanceDeltaMinutes: number;
  status: DayStatus;
  absenceType?: AbsenceType;
  openEntry: boolean; // true if the last punch of the day has no closing pair yet (still clocked in)
}

const ENTRY_ORDER: Record<EntryType, number> = {
  ENTRADA: 0,
  SAIDA_ALMOCO: 1,
  RETORNO_ALMOCO: 2,
  SAIDA: 3,
};

/**
 * Soma os intervalos "trabalhando" de uma sequência de batidas de ponto.
 * Estado alterna: ENTRADA (trabalhando) -> SAIDA_ALMOCO (pausa) -> RETORNO_ALMOCO (trabalhando) -> SAIDA (fim).
 * Se `now` for informado e o último evento deixar o dia "aberto", soma o tempo até `now`.
 */
export function computeWorkedMinutesFromEntries(
  entries: EntryLike[],
  now?: Date
): { workedMinutes: number; openEntry: boolean } {
  const sorted = [...entries].sort((a, b) => {
    const t = a.time.getTime() - b.time.getTime();
    if (t !== 0) return t;
    return ENTRY_ORDER[a.type] - ENTRY_ORDER[b.type];
  });

  let workedMs = 0;
  let working = false;
  let lastTime: Date | null = null;
  let openEntry = false;

  for (const entry of sorted) {
    if (working && lastTime) {
      workedMs += entry.time.getTime() - lastTime.getTime();
    }
    if (entry.type === "ENTRADA" || entry.type === "RETORNO_ALMOCO") {
      working = true;
    } else {
      working = false;
    }
    lastTime = entry.time;
  }

  if (working && lastTime) {
    openEntry = true;
    if (now) {
      workedMs += Math.max(0, now.getTime() - lastTime.getTime());
    }
  }

  return { workedMinutes: Math.round(workedMs / 60000), openEntry };
}

interface ComputeDayResultParams {
  date: Date;
  entries: EntryLike[];
  absence: AbsenceLike | null;
  schedule: WorkScheduleLike;
  isPast: boolean;
  isToday: boolean;
  now?: Date;
}

export function computeDayResult({
  date,
  entries,
  absence,
  schedule,
  isPast,
  isToday,
  now,
}: ComputeDayResultParams): DayResult {
  const isScheduledWorkday = schedule.workDays.includes(date.getDay());
  const expectedMinutesBase = isScheduledWorkday ? schedule.dailyHours * 60 : 0;

  if (!isPast && !isToday) {
    return {
      isScheduledWorkday,
      expectedMinutes: 0,
      workedMinutes: 0,
      extraMinutes: 0,
      negativeMinutes: 0,
      balanceDeltaMinutes: 0,
      status: "FUTURO",
      openEntry: false,
    };
  }

  if (absence) {
    switch (absence.type) {
      case "FERIAS":
      case "LICENCA":
      case "FOLGA": {
        return {
          isScheduledWorkday,
          expectedMinutes: 0,
          workedMinutes: 0,
          extraMinutes: 0,
          negativeMinutes: 0,
          balanceDeltaMinutes: 0,
          status: absence.type,
          absenceType: absence.type,
          openEntry: false,
        };
      }
      case "FALTA_JUSTIFICADA": {
        return {
          isScheduledWorkday,
          expectedMinutes: expectedMinutesBase,
          workedMinutes: 0,
          extraMinutes: 0,
          negativeMinutes: 0,
          balanceDeltaMinutes: 0,
          status: "FALTA_JUSTIFICADA",
          absenceType: absence.type,
          openEntry: false,
        };
      }
      case "FALTA_INJUSTIFICADA": {
        return {
          isScheduledWorkday,
          expectedMinutes: expectedMinutesBase,
          workedMinutes: 0,
          extraMinutes: 0,
          negativeMinutes: expectedMinutesBase,
          balanceDeltaMinutes: -expectedMinutesBase,
          status: "FALTA_INJUSTIFICADA",
          absenceType: absence.type,
          openEntry: false,
        };
      }
      case "BANCO_HORAS":
      case "COMPENSACAO": {
        const usedMinutes = Math.round((absence.hours ?? schedule.dailyHours) * 60);
        return {
          isScheduledWorkday,
          expectedMinutes: expectedMinutesBase,
          workedMinutes: 0,
          extraMinutes: 0,
          negativeMinutes: 0,
          balanceDeltaMinutes: -usedMinutes,
          status: absence.type,
          absenceType: absence.type,
          openEntry: false,
        };
      }
      case "HOME_OFFICE": {
        // segue o cálculo normal a partir das batidas de ponto (apenas identificado como remoto)
        break;
      }
    }
  }

  const { workedMinutes, openEntry } = computeWorkedMinutesFromEntries(entries, now);

  if (entries.length === 0) {
    if (!isScheduledWorkday) {
      return {
        isScheduledWorkday,
        expectedMinutes: 0,
        workedMinutes: 0,
        extraMinutes: 0,
        negativeMinutes: 0,
        balanceDeltaMinutes: 0,
        status: "FOLGA_PADRAO",
        openEntry: false,
      };
    }
    if (isToday) {
      return {
        isScheduledWorkday,
        expectedMinutes: expectedMinutesBase,
        workedMinutes: 0,
        extraMinutes: 0,
        negativeMinutes: 0,
        balanceDeltaMinutes: 0,
        status: "EM_ANDAMENTO",
        openEntry: false,
      };
    }
    // dia útil passado sem nenhum registro nem ausência cadastrada
    return {
      isScheduledWorkday,
      expectedMinutes: expectedMinutesBase,
      workedMinutes: 0,
      extraMinutes: 0,
      negativeMinutes: expectedMinutesBase,
      balanceDeltaMinutes: -expectedMinutesBase,
      status: "FALTA_NAO_REGISTRADA",
      openEntry: false,
    };
  }

  if (!isScheduledWorkday) {
    return {
      isScheduledWorkday,
      expectedMinutes: 0,
      workedMinutes,
      extraMinutes: workedMinutes,
      negativeMinutes: 0,
      balanceDeltaMinutes: workedMinutes,
      status: "TRABALHO_FOLGA",
      openEntry,
    };
  }

  const extraMinutes = Math.max(0, workedMinutes - expectedMinutesBase);
  const negativeMinutes = isToday && openEntry ? 0 : Math.max(0, expectedMinutesBase - workedMinutes);
  const balanceDeltaMinutes = isToday && openEntry ? 0 : workedMinutes - expectedMinutesBase;

  let status: DayStatus = "COMPLETO";
  if (isToday && openEntry) status = "EM_ANDAMENTO";
  else if (negativeMinutes > 0) status = "INCOMPLETO";
  else if (extraMinutes > 0) status = "HORA_EXTRA";
  if (absence?.type === "HOME_OFFICE") status = "HOME_OFFICE";

  return {
    isScheduledWorkday,
    expectedMinutes: expectedMinutesBase,
    workedMinutes,
    extraMinutes,
    negativeMinutes,
    balanceDeltaMinutes,
    status,
    absenceType: absence?.type,
    openEntry,
  };
}

export function minutesToHM(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}

export function minutesToDecimalHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}
