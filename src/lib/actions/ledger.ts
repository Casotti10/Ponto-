"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ledgerDayFromISO, parseAmountToCents } from "@/lib/ledger-calc";
import { appDateString } from "@/lib/timezone";
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

/**
 * A visão geral é uma rota própria e tem o seu próprio cache — revalidar só
 * `/financeiro` deixaria o histórico exibindo um lançamento que acabou de ser
 * apagado.
 */
function revalidateLedger() {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/geral");
  revalidatePath("/financeiro/a-pagar");
  revalidatePath("/financeiro/a-receber");
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
    status: formData.get("status") || undefined,
    dueDate: formData.get("dueDate") ?? "",
    settledDate: formData.get("settledDate") ?? "",
    paymentMethod: formData.get("paymentMethod") ?? "",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const {
    id,
    date,
    description,
    amount,
    type,
    accountId,
    categoryId,
    notes,
    status = "LIQUIDADO",
    dueDate,
    settledDate,
    paymentMethod,
  } = parsed.data;

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
    // `ledgerDayFromISO` grava o dia em meia-noite UTC. É o que faz o
    // lançamento cair no mês que o usuário digitou independentemente do fuso do
    // servidor que atendeu o formulário — ver a nota em `ledger-calc.ts`.
    date: ledgerDayFromISO(date),
    description,
    amountCents: amount,
    type,
    accountId,
    categoryId: categoryId || null,
    notes: notes || null,
    status,
    // Sem vencimento informado, vence na própria competência — é o caso da
    // esmagadora maioria dos lançamentos, e deixar nulo obrigaria todo filtro
    // de vencimento a um COALESCE.
    dueDate: dueDate ? ledgerDayFromISO(dueDate) : ledgerDayFromISO(date),
    // Coerência: só um lançamento LIQUIDADO tem data de liquidação. Aceitar uma
    // em algo pendente produziria a contradição "não pago, pago em 08/09".
    settledDate:
      status === "LIQUIDADO"
        ? ledgerDayFromISO(settledDate || dueDate || date)
        : null,
    paymentMethod: paymentMethod || null,
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
    startDate: ledgerDayFromISO(startDate),
    endDate: endDate ? ledgerDayFromISO(endDate) : null,
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

/* ---------------------------- Baixa de conta ----------------------------- */

/**
 * Marca um lançamento como liquidado — a "baixa" feita direto na lista de
 * contas a pagar/receber, sem abrir o formulário.
 *
 * `settledOn` em `yyyy-MM-dd`; ausente significa hoje no fuso do app. A data
 * importa: pagar hoje uma conta que venceu semana passada registra o pagamento
 * de hoje, não o vencimento.
 */
export async function settleTransaction(id: string, settledOn?: string): Promise<FormResult> {
  const user = await requireUser();

  const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Lançamento não encontrado" };
  if (existing.status === "LIQUIDADO") return { success: false, error: "Este lançamento já está liquidado" };
  if (existing.status === "CANCELADO") {
    return { success: false, error: "Um lançamento cancelado não pode ser liquidado" };
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      status: "LIQUIDADO",
      settledDate: ledgerDayFromISO(settledOn || appDateString()),
    },
  });

  await logAudit({
    userId: user.id,
    entity: "TRANSACTION",
    entityId: id,
    action: "UPDATE",
    before: { status: existing.status, settledDate: existing.settledDate },
    after: { status: updated.status, settledDate: updated.settledDate },
    reason: "Baixa de lançamento",
  });

  revalidateLedger();
  return { success: true };
}

/**
 * Desfaz a baixa. Existe porque errar o botão numa lista é fácil, e a
 * alternativa seria editar o lançamento inteiro para corrigir um clique.
 */
export async function unsettleTransaction(id: string): Promise<FormResult> {
  const user = await requireUser();

  const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { success: false, error: "Lançamento não encontrado" };
  if (existing.status !== "LIQUIDADO") return { success: false, error: "Este lançamento não está liquidado" };

  await prisma.transaction.update({
    where: { id },
    // A data de liquidação sai junto: manter uma data de pagamento num
    // lançamento pendente é a contradição que a action de gravação já evita.
    data: { status: "PENDENTE", settledDate: null },
  });

  await logAudit({
    userId: user.id,
    entity: "TRANSACTION",
    entityId: id,
    action: "UPDATE",
    before: { status: "LIQUIDADO", settledDate: existing.settledDate },
    after: { status: "PENDENTE", settledDate: null },
    reason: "Baixa desfeita",
  });

  revalidateLedger();
  return { success: true };
}
