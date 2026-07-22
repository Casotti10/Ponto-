import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe a senha"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const timeEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "Informe a data"),
  time: z.string().min(1, "Informe o horário"),
  type: z.enum(["ENTRADA", "SAIDA_ALMOCO", "RETORNO_ALMOCO", "SAIDA"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});
export type TimeEntryInput = z.infer<typeof timeEntrySchema>;

export const absenceSchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "Informe a data inicial"),
  endDate: z.string().optional().or(z.literal("")),
  type: z.enum([
    "FALTA_JUSTIFICADA",
    "FALTA_INJUSTIFICADA",
    "BANCO_HORAS",
    "FOLGA",
    "FERIAS",
    "LICENCA",
    "COMPENSACAO",
    "HOME_OFFICE",
  ]),
  hours: z.coerce.number().min(0).max(24).optional(),
  reason: z.string().max(500).optional().or(z.literal("")),
});
export type AbsenceInput = z.infer<typeof absenceSchema>;

export const balanceAdjustmentSchema = z.object({
  minutes: z.coerce.number().refine((v) => v !== 0, "Informe uma quantidade de minutos diferente de zero"),
  reason: z.string().min(3, "Informe o motivo do ajuste").max(500),
  date: z.string().optional().or(z.literal("")),
});
export type BalanceAdjustmentInput = z.infer<typeof balanceAdjustmentSchema>;

export const workScheduleSchema = z.object({
  dailyHours: z.coerce.number().min(1).max(24),
  weeklyHours: z.coerce.number().min(1).max(168),
  lunchBreakMinutes: z.coerce.number().min(0).max(480),
  toleranceMinutes: z.coerce.number().min(0).max(120),
  workDays: z.array(z.number().min(0).max(6)).min(1),
  entryTime: z.string(),
  lunchOutTime: z.string(),
  lunchReturnTime: z.string(),
  exitTime: z.string(),
});
export type WorkScheduleInput = z.infer<typeof workScheduleSchema>;

export const goalSchema = z.object({
  title: z.string().min(2).max(200),
  targetHours: z.coerce.number().min(0).max(1000),
  year: z.coerce.number(),
  month: z.coerce.number().min(1).max(12),
});
export type GoalInput = z.infer<typeof goalSchema>;

export const reportRangeSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});
