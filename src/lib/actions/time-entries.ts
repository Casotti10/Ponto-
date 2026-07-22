"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { timeEntrySchema } from "@/lib/validations";
import type { EntryType } from "@prisma/client";

export interface FormResult {
  success: boolean;
  error?: string;
}

function combineDateTime(dateStr: string, timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const date = new Date(`${dateStr}T00:00:00`);
  const dateTime = new Date(`${dateStr}T00:00:00`);
  dateTime.setHours(h, m, 0, 0);
  return { date, dateTime };
}

export async function punchNow(type: EntryType, notes?: string): Promise<FormResult> {
  const user = await requireUser();
  const now = new Date();
  const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const entry = await prisma.timeEntry.create({
    data: {
      userId: user.id,
      date: dateOnly,
      type,
      time: now,
      notes: notes || null,
      source: "PONTO_RAPIDO",
    },
  });

  await logAudit({
    userId: user.id,
    entity: "TIME_ENTRY",
    entityId: entry.id,
    action: "CREATE",
    after: { type, time: now.toISOString() },
    reason: "Registro rápido de ponto",
  });

  revalidatePath("/dashboard");
  revalidatePath("/ponto");
  revalidatePath("/calendario");
  return { success: true };
}

export async function createTimeEntry(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = timeEntrySchema.safeParse({
    date: formData.get("date"),
    time: formData.get("time"),
    type: formData.get("type"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const { date, time, type, notes } = parsed.data;
  const { date: dateOnly, dateTime } = combineDateTime(date, time);

  const entry = await prisma.timeEntry.create({
    data: {
      userId: user.id,
      date: dateOnly,
      type,
      time: dateTime,
      notes: notes || null,
      source: "MANUAL",
    },
  });

  await logAudit({
    userId: user.id,
    entity: "TIME_ENTRY",
    entityId: entry.id,
    action: "CREATE",
    after: { type, time: dateTime.toISOString(), notes },
    reason: "Criação manual de registro",
  });

  revalidatePath("/dashboard");
  revalidatePath("/ponto");
  revalidatePath("/calendario");
  return { success: true };
}

export async function updateTimeEntry(id: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = timeEntrySchema.safeParse({
    date: formData.get("date"),
    time: formData.get("time"),
    type: formData.get("type"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const existing = await prisma.timeEntry.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Registro não encontrado" };

  const { date, time, type, notes } = parsed.data;
  const { date: dateOnly, dateTime } = combineDateTime(date, time);

  const updated = await prisma.timeEntry.update({
    where: { id },
    data: {
      date: dateOnly,
      type,
      time: dateTime,
      notes: notes || null,
      source: "AJUSTE",
    },
  });

  await logAudit({
    userId: user.id,
    entity: "TIME_ENTRY",
    entityId: id,
    action: "UPDATE",
    before: { type: existing.type, time: existing.time.toISOString(), notes: existing.notes },
    after: { type: updated.type, time: updated.time.toISOString(), notes: updated.notes },
    reason: "Correção de horário",
  });

  revalidatePath("/dashboard");
  revalidatePath("/ponto");
  revalidatePath("/calendario");
  return { success: true };
}

export async function deleteTimeEntry(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.timeEntry.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Registro não encontrado" };

  await prisma.timeEntry.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    entity: "TIME_ENTRY",
    entityId: id,
    action: "DELETE",
    before: { type: existing.type, time: existing.time.toISOString(), notes: existing.notes },
    reason: "Exclusão de registro",
  });

  revalidatePath("/dashboard");
  revalidatePath("/ponto");
  revalidatePath("/calendario");
  return { success: true };
}

export async function duplicateTimeEntry(id: string, newDate?: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.timeEntry.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Registro não encontrado" };

  let date = existing.date;
  let time = existing.time;

  if (newDate) {
    const { date: d, dateTime } = combineDateTime(
      newDate,
      `${existing.time.getHours().toString().padStart(2, "0")}:${existing.time.getMinutes().toString().padStart(2, "0")}`
    );
    date = d;
    time = dateTime;
  }

  const duplicated = await prisma.timeEntry.create({
    data: {
      userId: user.id,
      date,
      type: existing.type,
      time,
      notes: existing.notes,
      source: "MANUAL",
    },
  });

  await logAudit({
    userId: user.id,
    entity: "TIME_ENTRY",
    entityId: duplicated.id,
    action: "CREATE",
    after: { type: duplicated.type, time: duplicated.time.toISOString() },
    reason: `Duplicado a partir do registro ${id}`,
  });

  revalidatePath("/dashboard");
  revalidatePath("/ponto");
  revalidatePath("/calendario");
  return { success: true };
}
