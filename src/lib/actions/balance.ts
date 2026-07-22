"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { balanceAdjustmentSchema } from "@/lib/validations";
import { closeMonth as closeMonthService } from "@/lib/time-service";
import type { FormResult } from "@/lib/actions/time-entries";

export async function createBalanceAdjustment(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = balanceAdjustmentSchema.safeParse({
    minutes: formData.get("minutes"),
    reason: formData.get("reason"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const { minutes, reason, date } = parsed.data;

  const adjustment = await prisma.balanceAdjustment.create({
    data: {
      userId: user.id,
      minutes,
      reason,
      date: date ? new Date(`${date}T00:00:00`) : new Date(),
      type: minutes >= 0 ? "MANUAL_ADD" : "MANUAL_REMOVE",
    },
  });

  await logAudit({
    userId: user.id,
    entity: "BALANCE_ADJUSTMENT",
    entityId: adjustment.id,
    action: "ADJUST",
    after: { minutes, reason },
    reason,
  });

  revalidatePath("/dashboard");
  revalidatePath("/banco-horas");
  revalidatePath("/historico");
  return { success: true };
}

export async function deleteBalanceAdjustment(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.balanceAdjustment.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Ajuste não encontrado" };

  await prisma.balanceAdjustment.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    entity: "BALANCE_ADJUSTMENT",
    entityId: id,
    action: "DELETE",
    before: { minutes: existing.minutes, reason: existing.reason },
    reason: "Exclusão de ajuste manual",
  });

  revalidatePath("/dashboard");
  revalidatePath("/banco-horas");
  revalidatePath("/historico");
  return { success: true };
}

export async function closeMonthAction(year: number, month: number): Promise<FormResult> {
  const user = await requireUser();
  await closeMonthService(user.id, year, month);
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/banco-horas");
  return { success: true };
}
