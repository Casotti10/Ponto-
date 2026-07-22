"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { updateWorkSchedule } from "@/lib/actions/settings";

const WEEK_DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export interface WorkScheduleData {
  dailyHours: number;
  weeklyHours: number;
  lunchBreakMinutes: number;
  toleranceMinutes: number;
  workDays: number[];
  entryTime: string;
  lunchOutTime: string;
  lunchReturnTime: string;
  exitTime: string;
}

export function WorkScheduleForm({ schedule }: { schedule: WorkScheduleData }) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateWorkSchedule(formData);
      if (result.success) toast.success("Jornada de trabalho atualizada");
      else toast.error(result.error ?? "Não foi possível salvar");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="dailyHours">Jornada diária (h)</Label>
          <Input id="dailyHours" name="dailyHours" type="number" step="0.5" min="1" max="24" defaultValue={schedule.dailyHours} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weeklyHours">Carga semanal (h)</Label>
          <Input id="weeklyHours" name="weeklyHours" type="number" step="0.5" min="1" max="168" defaultValue={schedule.weeklyHours} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lunchBreakMinutes">Intervalo (min)</Label>
          <Input id="lunchBreakMinutes" name="lunchBreakMinutes" type="number" min="0" max="480" defaultValue={schedule.lunchBreakMinutes} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="toleranceMinutes">Tolerância (min)</Label>
          <Input id="toleranceMinutes" name="toleranceMinutes" type="number" min="0" max="120" defaultValue={schedule.toleranceMinutes} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="entryTime">Entrada prevista</Label>
          <Input id="entryTime" name="entryTime" type="time" defaultValue={schedule.entryTime} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lunchOutTime">Saída almoço</Label>
          <Input id="lunchOutTime" name="lunchOutTime" type="time" defaultValue={schedule.lunchOutTime} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lunchReturnTime">Retorno almoço</Label>
          <Input id="lunchReturnTime" name="lunchReturnTime" type="time" defaultValue={schedule.lunchReturnTime} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exitTime">Saída prevista</Label>
          <Input id="exitTime" name="exitTime" type="time" defaultValue={schedule.exitTime} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Dias úteis</Label>
        <div className="flex flex-wrap gap-3">
          {WEEK_DAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5">
              <Checkbox name="workDays" value={String(day.value)} defaultChecked={schedule.workDays.includes(day.value)} />
              {day.label}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar jornada"}
      </Button>
    </form>
  );
}
