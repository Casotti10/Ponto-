"use client";

import { useState } from "react";
import { isSameMonth, isToday } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { minutesToHM } from "@/lib/time-calc";
import { cn } from "@/lib/utils";
import type { DayStatus } from "@/lib/time-calc";

export interface CalendarDay {
  dateIso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  status: DayStatus;
  workedMinutes: number;
  extraMinutes: number;
  negativeMinutes: number;
  balanceDeltaMinutes: number;
  entries: { type: string; time: string }[];
}

const STATUS_STYLE: Record<DayStatus, { bg: string; dot: string; label: string }> = {
  COMPLETO: { bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "Completo" },
  HORA_EXTRA: { bg: "bg-blue-500/10", dot: "bg-blue-500", label: "Hora extra" },
  INCOMPLETO: { bg: "bg-amber-500/10", dot: "bg-amber-500", label: "Incompleto" },
  FALTA_NAO_REGISTRADA: { bg: "bg-red-500/10", dot: "bg-red-500", label: "Falta não registrada" },
  FALTA_JUSTIFICADA: { bg: "bg-sky-500/10", dot: "bg-sky-500", label: "Falta justificada" },
  FALTA_INJUSTIFICADA: { bg: "bg-red-500/10", dot: "bg-red-500", label: "Falta injustificada" },
  FERIAS: { bg: "bg-indigo-500/10", dot: "bg-indigo-500", label: "Férias" },
  LICENCA: { bg: "bg-orange-500/10", dot: "bg-orange-500", label: "Licença" },
  FOLGA: { bg: "bg-pink-500/10", dot: "bg-pink-500", label: "Folga" },
  BANCO_HORAS: { bg: "bg-violet-500/10", dot: "bg-violet-500", label: "Banco de horas" },
  COMPENSACAO: { bg: "bg-violet-500/10", dot: "bg-violet-500", label: "Compensação" },
  HOME_OFFICE: { bg: "bg-teal-500/10", dot: "bg-teal-500", label: "Home office" },
  TRABALHO_FOLGA: { bg: "bg-blue-500/10", dot: "bg-blue-500", label: "Trabalho em folga" },
  FOLGA_PADRAO: { bg: "", dot: "bg-muted-foreground/30", label: "Fim de semana" },
  FUTURO: { bg: "", dot: "bg-muted-foreground/20", label: "Futuro" },
  EM_ANDAMENTO: { bg: "bg-blue-500/10", dot: "bg-blue-500 animate-pulse", label: "Em andamento" },
};

const WEEK_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MonthCalendar({ days }: { days: CalendarDay[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs font-medium text-muted-foreground">
        {WEEK_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const style = STATUS_STYLE[day.status];
          const referenceDate = new Date(day.dateIso);
          return (
            <Popover
              key={day.dateIso}
              open={selected === day.dateIso}
              onOpenChange={(open) => setSelected(open ? day.dateIso : null)}
            >
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg border text-xs transition-all hover:scale-[1.03] hover:shadow-sm",
                      day.isCurrentMonth ? style.bg : "opacity-40",
                      isToday(referenceDate) && "ring-2 ring-primary"
                    )}
                  />
                }
              >
                <span className="font-medium">{day.dayNumber}</span>
                {day.isCurrentMonth && day.status !== "FUTURO" && day.status !== "FOLGA_PADRAO" && (
                  <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                )}
                {day.isCurrentMonth && day.workedMinutes > 0 && (
                  <span className="hidden text-[10px] text-muted-foreground sm:block">
                    {minutesToHM(day.workedMinutes)}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">
                      {referenceDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                    </p>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", style.bg)}>{style.label}</span>
                  </div>
                  {day.entries.length > 0 && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {day.entries.map((e, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{e.type}</span>
                          <span className="font-mono">{e.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Trabalhado</p>
                      <p className="font-medium">{minutesToHM(day.workedMinutes)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Saldo</p>
                      <p className={cn("font-medium", day.balanceDeltaMinutes >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                        {minutesToHM(day.balanceDeltaMinutes)}
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

export { isSameMonth };
