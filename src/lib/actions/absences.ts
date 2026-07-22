"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { absenceSchema } from "@/lib/validations";
import type { AbsenceImpact, AbsenceType } from "@prisma/client";
import type { FormResult } from "@/lib/actions/time-entries";

const IMPACT_BY_TYPE: Record<AbsenceType, AbsenceImpact> = {
  FALTA_JUSTIFICADA: "NAO_DESCONTA",
  FALTA_INJUSTIFICADA: "DESCONTA",
  BANCO_HORAS: "ABATE_BANCO",
  FOLGA: "NEUTRO",
  FERIAS: "NEUTRO",
  LICENCA: "NEUTRO",
  COMPENSACAO: "ABATE_BANCO",
  HOME_OFFICE: "NEUTRO",
};

export async function createAbsence(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = absenceSchema.safeParse({
    date: formData.get("date"),
    endDate: formData.get("endDate"),
    type: formData.get("type"),
    hours: formData.get("hours") || undefined,
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const { date, endDate, type, hours, reason } = parsed.data;

  const absence = await prisma.absence.create({
    data: {
      userId: user.id,
      date: new Date(`${date}T00:00:00`),
      endDate: endDate ? new Date(`${endDate}T00:00:00`) : null,
      type,
      impact: IMPACT_BY_TYPE[type],
      hours: hours ?? null,
      reason: reason || null,
    },
  });

  await logAudit({
    userId: user.id,
    entity: "ABSENCE",
    entityId: absence.id,
    action: "CREATE",
    after: { type, date, endDate, hours, reason },
    reason: "Cadastro de ausência",
  });

  revalidatePath("/dashboard");
  revalidatePath("/ausencias");
  revalidatePath("/calendario");
  return { success: true };
}

export async function updateAbsence(id: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = absenceSchema.safeParse({
    date: formData.get("date"),
    endDate: formData.get("endDate"),
    type: formData.get("type"),
    hours: formData.get("hours") || undefined,
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const existing = await prisma.absence.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Ausência não encontrada" };

  const { date, endDate, type, hours, reason } = parsed.data;

  const updated = await prisma.absence.update({
    where: { id },
    data: {
      date: new Date(`${date}T00:00:00`),
      endDate: endDate ? new Date(`${endDate}T00:00:00`) : null,
      type,
      impact: IMPACT_BY_TYPE[type],
      hours: hours ?? null,
      reason: reason || null,
    },
  });

  await logAudit({
    userId: user.id,
    entity: "ABSENCE",
    entityId: id,
    action: "UPDATE",
    before: { type: existing.type, date: existing.date.toISOString(), reason: existing.reason },
    after: { type: updated.type, date: updated.date.toISOString(), reason: updated.reason },
    reason: "Edição de ausência",
  });

  revalidatePath("/dashboard");
  revalidatePath("/ausencias");
  revalidatePath("/calendario");
  return { success: true };
}

export async function deleteAbsence(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.absence.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Ausência não encontrada" };

  await prisma.absence.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    entity: "ABSENCE",
    entityId: id,
    action: "DELETE",
    before: { type: existing.type, date: existing.date.toISOString(), reason: existing.reason },
    reason: "Exclusão de ausência",
  });

  revalidatePath("/dashboard");
  revalidatePath("/ausencias");
  revalidatePath("/calendario");
  return { success: true };
}
