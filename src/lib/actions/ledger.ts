"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseAmountToCents } from "@/lib/ledger-calc";
import {
  accountSchema,
  categorySchema,
  recurringTransactionSchema,
  transactionSchema,
} from "@/lib/validations";
import type { FormResult } from "@/lib/actions/time-entries";

/**
 * Escrita do razão financeiro.
 *
 * Toda action segue o mesmo contrato das demais do sistema: autentica, valida
 * com Zod, grava, audita e revalida. E toda leitura de registro existente filtra
 * por `userId` — é o que impede um id de outro usuário de ser editado ou
 * apagado por quem não é dono.
 */

/** Converte "2026-08-03" para meia-noite LOCAL, e não UTC. */
function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function revalidateLedger() {
  revalidatePath("/financeiro");
}

/* ------------------------------ Lançamentos ------------------------------ */

export async function saveTransaction(formData: FormData): Promise<FormResult> {
  const user = await requireUser();

  const parsed = transactionSchema.safeParse({
    id: formData.get("id") || undefined,
    date: formData.get("date"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const { id, date, description, amount, type, accountId, categoryId, notes } = parsed.data;

  // A conta e a categoria precisam pertencer ao usuário — sem isso, um id
  // forjado no formulário lançaria dinheiro na conta de outra pessoa.
  const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return { success: false, error: "Conta não encontrada" };

  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id } });
    if (!category) return { success: false, error: "Categoria não encontrada" };
    if (category.type !== type) {
      return { success: false, error: "A categoria não corresponde ao tipo do lançamento" };
    }
  }

  const data = {
    date: parseLocalDate(date),
    description,
    amountCents: amount,
    type,
    accountId,
    categoryId: categoryId || null,
    notes: notes || null,
  };

  if (id) {
    const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
    if (!existing) return { success: false, error: "Lançamento não encontrado" };

    const updated = await prisma.transaction.update({ where: { id }, data });
    await logAudit({
      userId: user.id,
      entity: "TRANSACTION",
      entityId: id,
      action: "UPDATE",
      before: { description: existing.description, amountCents: existing.amountCents, type: existing.type },
      after: { description: updated.description, amountCents: updated.amountCents, type: updated.type },
      reason: "Edição de lançamento financeiro",
    });
  } else {
    const created = await prisma.transaction.create({ data: { ...data, userId: user.id } });
    await logAudit({
      userId: user.id,
      entity: "TRANSACTION",
      entityId: created.id,
      action: "CREATE",
      after: { description: created.description, amountCents: created.amountCents, type: created.type },
      reason: "Novo lançamento financeiro",
    });
  }

  revalidateLedger();
  return { success: true };
}

export async function deleteTransaction(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Lançamento não encontrado" };

  await prisma.transaction.delete({ where: { id } });
  await logAudit({
    userId: user.id,
    entity: "TRANSACTION",
    entityId: id,
    action: "DELETE",
    before: { description: existing.description, amountCents: existing.amountCents, type: existing.type },
    reason: "Exclusão de lançamento financeiro",
  });

  revalidateLedger();
  return { success: true };
}

/* --------------------------------- Contas -------------------------------- */

export async function saveAccount(formData: FormData): Promise<FormResult> {
  const user = await requireUser();

  const parsed = accountSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    type: formData.get("type"),
    openingBalance: formData.get("openingBalance") ?? "",
    color: formData.get("color"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const { id, name, type, openingBalance, color } = parsed.data;
  const openingBalanceCents = openingBalance ? (parseAmountToCents(openingBalance) ?? 0) : 0;

  const duplicate = await prisma.account.findFirst({
    where: { userId: user.id, name, ...(id ? { NOT: { id } } : {}) },
  });
  if (duplicate) return { success: false, error: "Já existe uma conta com esse nome" };

  if (id) {
    const existing = await prisma.account.findFirst({ where: { id, userId: user.id } });
    if (!existing) return { success: false, error: "Conta não encontrada" };

    await prisma.account.update({ where: { id }, data: { name, type, openingBalanceCents, color } });
    await logAudit({
      userId: user.id,
      entity: "ACCOUNT",
      entityId: id,
      action: "UPDATE",
      before: { name: existing.name, openingBalanceCents: existing.openingBalanceCents },
      after: { name, openingBalanceCents },
      reason: "Edição de conta",
    });
  } else {
    const created = await prisma.account.create({
      data: { userId: user.id, name, type, openingBalanceCents, color },
    });
    await logAudit({
      userId: user.id,
      entity: "ACCOUNT",
      entityId: created.id,
      action: "CREATE",
      after: { name, openingBalanceCents },
      reason: "Nova conta",
    });
  }

  revalidateLedger();
  return { success: true };
}

export async function deleteAccount(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.account.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Conta não encontrada" };

  // Apagar a conta levaria junto todos os lançamentos dela (onDelete: Cascade).
  // Isso é destruição silenciosa de histórico, então é bloqueado: o caminho para
  // "parar de usar" uma conta com movimento é arquivar.
  const transactionCount = await prisma.transaction.count({ where: { accountId: id } });
  if (transactionCount > 0) {
    return {
      success: false,
      error: `Esta conta tem ${transactionCount} lançamento(s). Arquive-a em vez de excluir.`,
    };
  }

  const remaining = await prisma.account.count({ where: { userId: user.id } });
  if (remaining <= 1) return { success: false, error: "Você precisa manter ao menos uma conta" };

  await prisma.account.delete({ where: { id } });
  await logAudit({
    userId: user.id,
    entity: "ACCOUNT",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name },
    reason: "Exclusão de conta",
  });

  revalidateLedger();
  return { success: true };
}

export async function toggleAccountArchived(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.account.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Conta não encontrada" };

  await prisma.account.update({ where: { id }, data: { archived: !existing.archived } });
  revalidateLedger();
  return { success: true };
}

/* ------------------------------- Categorias ------------------------------ */

export async function saveCategory(formData: FormData): Promise<FormResult> {
  const user = await requireUser();

  const parsed = categorySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    type: formData.get("type"),
    color: formData.get("color"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const { id, name, type, color } = parsed.data;

  const duplicate = await prisma.category.findFirst({
    where: { userId: user.id, name, type, ...(id ? { NOT: { id } } : {}) },
  });
  if (duplicate) return { success: false, error: "Já existe uma categoria com esse nome e tipo" };

  if (id) {
    const existing = await prisma.category.findFirst({ where: { id, userId: user.id } });
    if (!existing) return { success: false, error: "Categoria não encontrada" };

    await prisma.category.update({ where: { id }, data: { name, type, color } });
    await logAudit({
      userId: user.id,
      entity: "CATEGORY",
      entityId: id,
      action: "UPDATE",
      before: { name: existing.name, type: existing.type },
      after: { name, type },
      reason: "Edição de categoria",
    });
  } else {
    const created = await prisma.category.create({ data: { userId: user.id, name, type, color } });
    await logAudit({
      userId: user.id,
      entity: "CATEGORY",
      entityId: created.id,
      action: "CREATE",
      after: { name, type },
      reason: "Nova categoria",
    });
  }

  revalidateLedger();
  return { success: true };
}

export async function deleteCategory(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.category.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Categoria não encontrada" };

  // Os lançamentos NÃO são apagados: a FK é onDelete SetNull, então eles caem
  // em "Sem categoria" e o total do mês continua fechando.
  await prisma.category.delete({ where: { id } });
  await logAudit({
    userId: user.id,
    entity: "CATEGORY",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name, type: existing.type },
    reason: "Exclusão de categoria",
  });

  revalidateLedger();
  return { success: true };
}

/* ------------------------------ Recorrentes ------------------------------ */

export async function saveRecurringTransaction(formData: FormData): Promise<FormResult> {
  const user = await requireUser();

  const parsed = recurringTransactionSchema.safeParse({
    id: formData.get("id") || undefined,
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId") ?? "",
    frequency: formData.get("frequency"),
    dayOfMonth: formData.get("dayOfMonth") ?? 1,
    weekday: formData.get("weekday") ?? 1,
    monthOfYear: formData.get("monthOfYear") ?? 1,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") ?? "",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const { id, categoryId, accountId, type, startDate, endDate, amount, ...rest } = parsed.data;

  const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return { success: false, error: "Conta não encontrada" };

  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id } });
    if (!category) return { success: false, error: "Categoria não encontrada" };
    if (category.type !== type) {
      return { success: false, error: "A categoria não corresponde ao tipo do lançamento" };
    }
  }

  const data = {
    ...rest,
    type,
    accountId,
    categoryId: categoryId || null,
    amountCents: amount,
    startDate: parseLocalDate(startDate),
    endDate: endDate ? parseLocalDate(endDate) : null,
  };

  if (id) {
    const existing = await prisma.recurringTransaction.findFirst({ where: { id, userId: user.id } });
    if (!existing) return { success: false, error: "Recorrência não encontrada" };

    await prisma.recurringTransaction.update({ where: { id }, data });
    await logAudit({
      userId: user.id,
      entity: "RECURRING_TRANSACTION",
      entityId: id,
      action: "UPDATE",
      before: { description: existing.description, amountCents: existing.amountCents },
      after: { description: data.description, amountCents: data.amountCents },
      reason: "Edição de lançamento recorrente",
    });
  } else {
    const created = await prisma.recurringTransaction.create({ data: { ...data, userId: user.id } });
    await logAudit({
      userId: user.id,
      entity: "RECURRING_TRANSACTION",
      entityId: created.id,
      action: "CREATE",
      after: { description: data.description, amountCents: data.amountCents },
      reason: "Novo lançamento recorrente",
    });
  }

  revalidateLedger();
  return { success: true };
}

export async function toggleRecurringActive(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.recurringTransaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Recorrência não encontrada" };

  await prisma.recurringTransaction.update({ where: { id }, data: { active: !existing.active } });
  revalidateLedger();
  return { success: true };
}

/**
 * Remove a recorrência. Os lançamentos já gerados PERMANECEM (a FK é SetNull):
 * eles representam dinheiro que de fato entrou ou saiu, e apagá-los mudaria
 * saldos passados que o usuário já conferiu.
 */
export async function deleteRecurringTransaction(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.recurringTransaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Recorrência não encontrada" };

  await prisma.recurringTransaction.delete({ where: { id } });
  await logAudit({
    userId: user.id,
    entity: "RECURRING_TRANSACTION",
    entityId: id,
    action: "DELETE",
    before: { description: existing.description, amountCents: existing.amountCents },
    reason: "Exclusão de lançamento recorrente",
  });

  revalidateLedger();
  return { success: true };
}
