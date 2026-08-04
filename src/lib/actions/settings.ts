"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { workScheduleSchema, goalSchema, profileSchema, changePasswordSchema } from "@/lib/validations";
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

export interface ChangePasswordState {
  success?: boolean;
  error?: string;
}

/**
 * Altera a senha do usuário autenticado.
 *
 * Validações:
 * 1. Senha atual deve estar correta
 * 2. Nova senha deve atender aos requisitos de segurança
 * 3. Nova senha não pode ser igual à anterior
 * 4. Confirmação deve ser igual à nova senha
 */
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  // Obter usuário atual do banco
  const userWithPassword = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!userWithPassword) {
    return { error: "Usuário não encontrado" };
  }

  // Verificar se a senha atual está correta
  const passwordMatch = await bcrypt.compare(parsed.data.currentPassword, userWithPassword.passwordHash);

  if (!passwordMatch) {
    return { error: "Senha atual incorreta" };
  }

  // Hash da nova senha
  const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  // Atualizar senha no banco
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newPasswordHash },
  });

  // Registrar na auditoria
  await logAudit({
    userId: user.id,
    entity: "USER",
    entityId: user.id,
    action: "UPDATE",
    before: { hasPassword: true },
    after: { hasPassword: true },
    reason: "Alteração de senha",
  });

  revalidatePath("/", "layout");
  return { success: true };
}
