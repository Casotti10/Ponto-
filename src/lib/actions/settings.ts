"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { workScheduleSchema, goalSchema, profileSchema } from "@/lib/validations";
import type { FormResult } from "@/lib/actions/time-entries";

export async function updateProfile(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const existing = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });

  await logAudit({
    userId: user.id,
    entity: "USER",
    entityId: user.id,
    action: "UPDATE",
    before: { name: existing.name },
    after: { name: updated.name },
    reason: "Atualização do nome de exibição",
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateWorkSchedule(formData: FormData): Promise<FormResult> {
  const user = await requireUser();

  const workDaysRaw = formData.getAll("workDays");
  const parsed = workScheduleSchema.safeParse({
    dailyHours: formData.get("dailyHours"),
    weeklyHours: formData.get("weeklyHours"),
    lunchBreakMinutes: formData.get("lunchBreakMinutes"),
    toleranceMinutes: formData.get("toleranceMinutes"),
    workDays: workDaysRaw.map((v) => Number(v)),
    entryTime: formData.get("entryTime"),
    lunchOutTime: formData.get("lunchOutTime"),
    lunchReturnTime: formData.get("lunchReturnTime"),
    exitTime: formData.get("exitTime"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const existing = await prisma.workSchedule.findUnique({ where: { userId: user.id } });

  const updated = await prisma.workSchedule.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: parsed.data,
  });

  await logAudit({
    userId: user.id,
    entity: "WORK_SCHEDULE",
    entityId: updated.id,
    action: existing ? "UPDATE" : "CREATE",
    before: existing ? { dailyHours: existing.dailyHours, weeklyHours: existing.weeklyHours } : null,
    after: { dailyHours: updated.dailyHours, weeklyHours: updated.weeklyHours },
    reason: "Atualização da jornada de trabalho",
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function createGoal(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = goalSchema.safeParse({
    title: formData.get("title"),
    targetHours: formData.get("targetHours"),
    year: formData.get("year"),
    month: formData.get("month"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  await prisma.goal.create({ data: { userId: user.id, ...parsed.data } });

  revalidatePath("/dashboard");
  revalidatePath("/configuracoes");
  return { success: true };
}

export async function deleteGoal(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.goal.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Meta não encontrada" };

  await prisma.goal.delete({ where: { id } });

  revalidatePath("/dashboard");
  revalidatePath("/configuracoes");
  return { success: true };
}
