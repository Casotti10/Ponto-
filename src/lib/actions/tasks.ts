"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { moveId, positionUpdates } from "@/lib/task-calc";
import {
  getCardDetailView,
  type CardDetailView,
  type ChecklistItemView,
  type ChecklistView,
} from "@/lib/task-service";
import {
  boardColumnSchema,
  boardSchema,
  cardNotesSchema,
  checklistItemSchema,
  taskCardSchema,
  taskLabelSchema,
} from "@/lib/validations";
import type { FormResult } from "@/lib/actions/time-entries";
import type { Prisma, TaskActivityType } from "@prisma/client";

/**
 * Escrita do quadro de tarefas.
 *
 * Toda action segue o contrato das demais do sistema: autentica, valida com
 * Zod, grava, registra o evento e revalida. E toda leitura de registro
 * existente atravessa o quadro até o `userId` — é isso que impede um id
 * forjado no cliente de mover ou apagar o card de outra pessoa.
 *
 * O histórico tem duas camadas de propósito diferente:
 *
 * - `TaskActivity` é a linha do tempo do card, que o usuário lê dentro do
 *   drawer. Registra tudo, inclusive movimentos.
 * - `AuditLog` é a trilha de auditoria global da aplicação (`/historico`).
 *   Recebe só criação e exclusão de quadro, coluna e card: registrar cada
 *   arrasto ali afogaria os eventos de ponto e financeiro em ruído.
 */

const TASKS_PATH = "/tarefas";

function revalidateTasks() {
  revalidatePath(TASKS_PATH);
}

/* ------------------------------ Posse e apoio ------------------------------ */

async function findOwnedBoard(userId: string, boardId: string) {
  return prisma.board.findFirst({ where: { id: boardId, userId } });
}

async function findOwnedColumn(userId: string, columnId: string) {
  return prisma.boardColumn.findFirst({ where: { id: columnId, board: { userId } } });
}

async function findOwnedCard(userId: string, cardId: string) {
  return prisma.taskCard.findFirst({ where: { id: cardId, board: { userId } } });
}

async function logActivity(params: {
  boardId: string;
  cardId: string | null;
  userId: string;
  type: TaskActivityType;
  message: string;
}) {
  await prisma.taskActivity.create({ data: params });
}

/** "2026-08-10" vira meia-noite LOCAL, e não UTC — mesma regra do financeiro. */
function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

/**
 * Reescreve as posições de uma coluna a partir de uma ordem de ids.
 *
 * Devolve promises de update em vez de executá-las para que quem chama junte
 * as duas colunas envolvidas em um `$transaction` só: metade de um movimento
 * gravado deixaria a ordenação furada.
 */
function orderUpdates(orderedIds: string[], current: Map<string, number>) {
  return positionUpdates(orderedIds, current).map(({ id, position }) =>
    prisma.taskCard.update({ where: { id }, data: { position } })
  );
}

async function columnCardOrder(columnId: string) {
  const cards = await prisma.taskCard.findMany({
    where: { columnId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  return {
    ids: cards.map((card) => card.id),
    positions: new Map(cards.map((card) => [card.id, card.position])),
  };
}

/* --------------------------------- Quadros -------------------------------- */

export async function saveBoard(formData: FormData): Promise<FormResult> {
  const user = await requireUser();

  const parsed = boardSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { id, name, description } = parsed.data;

  const duplicate = await prisma.board.findFirst({
    where: { userId: user.id, name, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (duplicate) return { success: false, error: "Já existe um quadro com esse nome" };

  if (id) {
    const existing = await findOwnedBoard(user.id, id);
    if (!existing) return { success: false, error: "Quadro não encontrado" };

    await prisma.board.update({
      where: { id },
      data: { name, description: description || null },
    });
    await logAudit({
      userId: user.id,
      entity: "TASK_BOARD",
      entityId: id,
      action: "UPDATE",
      before: { name: existing.name },
      after: { name },
      reason: "Edição de quadro",
    });
  } else {
    const count = await prisma.board.count({ where: { userId: user.id } });
    const created = await prisma.board.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        position: count,
        // Um quadro sem coluna nenhuma não recebe card e parece quebrado.
        columns: {
          create: [
            { name: "A Fazer", color: "#898781", position: 0 },
            { name: "Em Andamento", color: "#2a78d6", position: 1 },
            { name: "Concluído", color: "#1baf7a", position: 2, isDone: true },
          ],
        },
      },
    });
    await logAudit({
      userId: user.id,
      entity: "TASK_BOARD",
      entityId: created.id,
      action: "CREATE",
      after: { name },
      reason: "Novo quadro de tarefas",
    });
  }

  revalidateTasks();
  return { success: true };
}

export async function deleteBoard(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await findOwnedBoard(user.id, id);
  if (!existing) return { success: false, error: "Quadro não encontrado" };

  const remaining = await prisma.board.count({ where: { userId: user.id } });
  if (remaining <= 1) return { success: false, error: "Você precisa manter ao menos um quadro" };

  // O cascade leva colunas, cards, checklists, anotações e histórico junto.
  await prisma.board.delete({ where: { id } });
  await logAudit({
    userId: user.id,
    entity: "TASK_BOARD",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name },
    reason: "Exclusão de quadro",
  });

  revalidateTasks();
  return { success: true };
}

/* --------------------------------- Colunas -------------------------------- */

export async function saveColumn(formData: FormData): Promise<FormResult> {
  const user = await requireUser();

  const parsed = boardColumnSchema.safeParse({
    id: formData.get("id") || undefined,
    boardId: formData.get("boardId"),
    name: formData.get("name"),
    color: formData.get("color"),
    isDone: formData.get("isDone") === "on" || formData.get("isDone") === "true",
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { id, boardId, name, color, isDone } = parsed.data;

  const board = await findOwnedBoard(user.id, boardId);
  if (!board) return { success: false, error: "Quadro não encontrado" };

  if (id) {
    const existing = await findOwnedColumn(user.id, id);
    if (!existing) return { success: false, error: "Coluna não encontrada" };

    await prisma.boardColumn.update({ where: { id }, data: { name, color, isDone } });

    // Marcar (ou desmarcar) uma coluna como terminal precisa alcançar os cards
    // que já estavam nela: senão a coluna "Concluído" ficaria cheia de cards
    // que o sistema ainda considera abertos.
    if (existing.isDone !== isDone) {
      await prisma.taskCard.updateMany({
        where: { columnId: id },
        data: { completed: isDone, completedAt: isDone ? new Date() : null },
      });
    }

    if (existing.name !== name) {
      await logActivity({
        boardId,
        cardId: null,
        userId: user.id,
        type: "COLUMN_RENAMED",
        message: `renomeou a coluna "${existing.name}" para "${name}"`,
      });
    }
  } else {
    const count = await prisma.boardColumn.count({ where: { boardId } });
    const created = await prisma.boardColumn.create({
      data: { boardId, name, color, isDone, position: count },
    });
    await logActivity({
      boardId,
      cardId: null,
      userId: user.id,
      type: "COLUMN_CREATED",
      message: `criou a coluna "${name}"`,
    });
    await logAudit({
      userId: user.id,
      entity: "TASK_COLUMN",
      entityId: created.id,
      action: "CREATE",
      after: { name },
      reason: "Nova coluna do quadro",
    });
  }

  revalidateTasks();
  return { success: true };
}

export async function deleteColumn(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await findOwnedColumn(user.id, id);
  if (!existing) return { success: false, error: "Coluna não encontrada" };

  const remaining = await prisma.boardColumn.count({ where: { boardId: existing.boardId } });
  if (remaining <= 1) return { success: false, error: "O quadro precisa de ao menos uma coluna" };

  // Apagar a coluna apaga os cards dela (onDelete: Cascade). Isso é destruição
  // silenciosa de trabalho registrado, então exige a coluna vazia — o caminho
  // para esvaziá-la é arrastar os cards para outro lugar.
  const cardCount = await prisma.taskCard.count({ where: { columnId: id } });
  if (cardCount > 0) {
    return {
      success: false,
      error: `Esta coluna tem ${cardCount} card(s). Mova-os para outra coluna antes de excluir.`,
    };
  }

  await prisma.boardColumn.delete({ where: { id } });
  await logActivity({
    boardId: existing.boardId,
    cardId: null,
    userId: user.id,
    type: "COLUMN_DELETED",
    message: `excluiu a coluna "${existing.name}"`,
  });
  await logAudit({
    userId: user.id,
    entity: "TASK_COLUMN",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name },
    reason: "Exclusão de coluna",
  });

  revalidateTasks();
  return { success: true };
}

/** Reordena as colunas a partir da ordem final vinda do arrasto. */
export async function reorderColumns(boardId: string, orderedIds: string[]): Promise<FormResult> {
  const user = await requireUser();
  const board = await findOwnedBoard(user.id, boardId);
  if (!board) return { success: false, error: "Quadro não encontrado" };

  const columns = await prisma.boardColumn.findMany({
    where: { boardId },
    select: { id: true, position: true },
  });

  // A lista precisa ser exatamente o conjunto de colunas do quadro; um id a
  // mais ou a menos deixaria posições duplicadas ou órfãs.
  const known = new Set(columns.map((column) => column.id));
  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    return { success: false, error: "Ordem de colunas inválida" };
  }

  const current = new Map(columns.map((column) => [column.id, column.position]));
  const updates = positionUpdates(orderedIds, current).map(({ id, position }) =>
    prisma.boardColumn.update({ where: { id }, data: { position } })
  );

  if (updates.length > 0) await prisma.$transaction(updates);

  revalidateTasks();
  return { success: true };
}

/* ---------------------------------- Cards --------------------------------- */

export async function saveCard(formData: FormData): Promise<FormResult> {
  const user = await requireUser();

  const parsed = taskCardSchema.safeParse({
    id: formData.get("id") || undefined,
    columnId: formData.get("columnId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate") ?? "",
    color: formData.get("color") ?? "",
    labelIds: formData.get("labelIds") ?? "",
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { id, columnId, title, description, priority, dueDate, color, labelIds } = parsed.data;

  const column = await findOwnedColumn(user.id, columnId);
  if (!column) return { success: false, error: "Coluna não encontrada" };

  const selectedLabelIds = (labelIds ?? "").split(",").filter(Boolean);
  if (selectedLabelIds.length > 0) {
    // Etiqueta de outro quadro no card criaria um vínculo que a tela do quadro
    // nunca conseguiria exibir.
    const valid = await prisma.taskLabel.count({
      where: { id: { in: selectedLabelIds }, boardId: column.boardId },
    });
    if (valid !== selectedLabelIds.length) {
      return { success: false, error: "Etiqueta inválida para este quadro" };
    }
  }

  const data = {
    title,
    description: description || null,
    priority,
    color: color || null,
    dueDate: dueDate ? parseLocalDate(dueDate) : null,
  };

  if (id) {
    const existing = await findOwnedCard(user.id, id);
    if (!existing) return { success: false, error: "Card não encontrado" };

    const movedColumn = existing.columnId !== columnId;
    const completed = movedColumn ? column.isDone : existing.completed;

    await prisma.taskCard.update({
      where: { id },
      data: {
        ...data,
        columnId,
        // Trocar a coluna pelo formulário tem o mesmo efeito de arrastar: o card
        // vai para o fim da nova coluna e acompanha o estado dela.
        ...(movedColumn
          ? {
              position: await prisma.taskCard.count({ where: { columnId } }),
              completed,
              completedAt: completed ? new Date() : null,
            }
          : {}),
      },
    });

    await prisma.taskCardLabel.deleteMany({ where: { cardId: id } });
    if (selectedLabelIds.length > 0) {
      await prisma.taskCardLabel.createMany({
        data: selectedLabelIds.map((labelId) => ({ cardId: id, labelId })),
        skipDuplicates: true,
      });
    }

    // O histórico distingue renomear de "mexeu em outra coisa" porque é a
    // pergunta que mais se faz depois: por que o nome deste card mudou.
    if (existing.title !== title) {
      await logActivity({
        boardId: existing.boardId,
        cardId: id,
        userId: user.id,
        type: "CARD_RENAMED",
        message: `renomeou o card de "${existing.title}" para "${title}"`,
      });
    } else {
      await logActivity({
        boardId: existing.boardId,
        cardId: id,
        userId: user.id,
        type: "CARD_UPDATED",
        message: "atualizou os dados do card",
      });
    }

    if (movedColumn) {
      await logActivity({
        boardId: existing.boardId,
        cardId: id,
        userId: user.id,
        type: "CARD_MOVED",
        message: `moveu o card para "${column.name}"`,
      });
    }
  } else {
    const position = await prisma.taskCard.count({ where: { columnId } });
    const created = await prisma.taskCard.create({
      data: {
        ...data,
        boardId: column.boardId,
        columnId,
        position,
        assigneeId: user.id,
        completed: column.isDone,
        completedAt: column.isDone ? new Date() : null,
        ...(selectedLabelIds.length > 0
          ? { labels: { create: selectedLabelIds.map((labelId) => ({ labelId })) } }
          : {}),
      },
    });

    await logActivity({
      boardId: column.boardId,
      cardId: created.id,
      userId: user.id,
      type: "CARD_CREATED",
      message: `criou o card em "${column.name}"`,
    });
    await logAudit({
      userId: user.id,
      entity: "TASK_CARD",
      entityId: created.id,
      action: "CREATE",
      after: { title, column: column.name },
      reason: "Novo card de tarefa",
    });
  }

  revalidateTasks();
  return { success: true };
}

export async function deleteCard(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await findOwnedCard(user.id, id);
  if (!existing) return { success: false, error: "Card não encontrado" };

  await prisma.taskCard.delete({ where: { id } });

  // O evento sobrevive ao card: `TaskActivity.cardId` é SetNull, e o título já
  // está na mensagem, então a linha do tempo do quadro continua legível.
  await logActivity({
    boardId: existing.boardId,
    cardId: null,
    userId: user.id,
    type: "CARD_DELETED",
    message: `excluiu o card "${existing.title}"`,
  });
  await logAudit({
    userId: user.id,
    entity: "TASK_CARD",
    entityId: id,
    action: "DELETE",
    before: { title: existing.title },
    reason: "Exclusão de card",
  });

  revalidateTasks();
  return { success: true };
}

/**
 * Duplica um card com etiquetas, checklists e anotações.
 *
 * A cópia nasce logo abaixo do original — é onde o usuário espera encontrá-la —
 * o que exige empurrar quem estava dali para baixo antes de inserir.
 */
export async function duplicateCard(id: string): Promise<FormResult> {
  const user = await requireUser();

  const original = await prisma.taskCard.findFirst({
    where: { id, board: { userId: user.id } },
    include: {
      labels: { select: { labelId: true } },
      note: { select: { content: true } },
      checklists: {
        orderBy: { position: "asc" },
        include: { items: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!original) return { success: false, error: "Card não encontrado" };

  await prisma.taskCard.updateMany({
    where: { columnId: original.columnId, position: { gt: original.position } },
    data: { position: { increment: 1 } },
  });

  const copy = await prisma.taskCard.create({
    data: {
      boardId: original.boardId,
      columnId: original.columnId,
      title: `${original.title} (cópia)`,
      description: original.description,
      color: original.color,
      priority: original.priority,
      dueDate: original.dueDate,
      position: original.position + 1,
      assigneeId: original.assigneeId,
      completed: original.completed,
      completedAt: original.completedAt,
      labels: { create: original.labels.map((link) => ({ labelId: link.labelId })) },
      ...(original.note ? { note: { create: { content: original.note.content } } } : {}),
      checklists: {
        create: original.checklists.map((checklist) => ({
          title: checklist.title,
          position: checklist.position,
          items: {
            create: checklist.items.map((item) => ({
              content: item.content,
              // A cópia começa do zero: um checklist já marcado descreveria um
              // trabalho que ninguém fez na tarefa nova.
              done: false,
              position: item.position,
            })),
          },
        })),
      },
    },
  });

  await logActivity({
    boardId: original.boardId,
    cardId: copy.id,
    userId: user.id,
    type: "CARD_DUPLICATED",
    message: `duplicou o card "${original.title}"`,
  });
  await logAudit({
    userId: user.id,
    entity: "TASK_CARD",
    entityId: copy.id,
    action: "CREATE",
    after: { title: copy.title },
    reason: "Duplicação de card",
  });

  revalidateTasks();
  return { success: true };
}

/**
 * Persiste um arrasto: nova coluna e nova posição.
 *
 * A posição final é recalculada aqui a partir do estado do banco, e não
 * confiada ao índice que o cliente mandou. As duas colunas afetadas são
 * gravadas em uma transação só.
 */
export async function moveCard(
  cardId: string,
  toColumnId: string,
  toIndex: number
): Promise<FormResult> {
  const user = await requireUser();

  const card = await findOwnedCard(user.id, cardId);
  if (!card) return { success: false, error: "Card não encontrado" };

  const target = await prisma.boardColumn.findFirst({
    where: { id: toColumnId, boardId: card.boardId },
  });
  if (!target) return { success: false, error: "Coluna de destino não encontrada" };

  const sameColumn = card.columnId === toColumnId;
  const source = await columnCardOrder(card.columnId);
  const destination = sameColumn ? source : await columnCardOrder(toColumnId);

  const next = moveId(source.ids, destination.ids, cardId, toIndex);

  const writes: Prisma.PrismaPromise<unknown>[] = [
    ...orderUpdates(next.destination, destination.positions),
    ...(sameColumn ? [] : orderUpdates(next.source, source.positions)),
  ];

  // `completed` acompanha a coluna de destino: é o que dá sentido a arrastar
  // para "Concluído" — e a voltar de lá.
  const becameDone = target.isDone && !card.completed;
  const reopened = !target.isDone && card.completed;

  writes.push(
    prisma.taskCard.update({
      where: { id: cardId },
      data: {
        columnId: toColumnId,
        position: next.destination.indexOf(cardId),
        ...(becameDone ? { completed: true, completedAt: new Date() } : {}),
        ...(reopened ? { completed: false, completedAt: null } : {}),
      },
    })
  );

  await prisma.$transaction(writes);

  if (!sameColumn) {
    await logActivity({
      boardId: card.boardId,
      cardId,
      userId: user.id,
      type: becameDone ? "CARD_COMPLETED" : reopened ? "CARD_REOPENED" : "CARD_MOVED",
      message: `moveu o card para "${target.name}"`,
    });
  }

  revalidateTasks();
  return { success: true };
}

/** Marca ou desmarca a tarefa como concluída sem sair da coluna. */
export async function toggleCardCompleted(id: string): Promise<FormResult> {
  const user = await requireUser();
  const card = await findOwnedCard(user.id, id);
  if (!card) return { success: false, error: "Card não encontrado" };

  const completed = !card.completed;
  await prisma.taskCard.update({
    where: { id },
    data: { completed, completedAt: completed ? new Date() : null },
  });

  await logActivity({
    boardId: card.boardId,
    cardId: id,
    userId: user.id,
    type: completed ? "CARD_COMPLETED" : "CARD_REOPENED",
    message: completed ? "concluiu a tarefa" : "reabriu a tarefa",
  });

  revalidateTasks();
  return { success: true };
}

/* -------------------------------- Etiquetas ------------------------------- */

export async function saveLabel(formData: FormData): Promise<FormResult> {
  const user = await requireUser();

  const parsed = taskLabelSchema.safeParse({
    id: formData.get("id") || undefined,
    boardId: formData.get("boardId"),
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { id, boardId, name, color } = parsed.data;

  const board = await findOwnedBoard(user.id, boardId);
  if (!board) return { success: false, error: "Quadro não encontrado" };

  const duplicate = await prisma.taskLabel.findFirst({
    where: { boardId, name, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (duplicate) return { success: false, error: "Já existe uma etiqueta com esse nome" };

  if (id) {
    const existing = await prisma.taskLabel.findFirst({ where: { id, boardId } });
    if (!existing) return { success: false, error: "Etiqueta não encontrada" };
    await prisma.taskLabel.update({ where: { id }, data: { name, color } });
  } else {
    await prisma.taskLabel.create({ data: { boardId, name, color } });
  }

  revalidateTasks();
  return { success: true };
}

export async function deleteLabel(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await prisma.taskLabel.findFirst({
    where: { id, board: { userId: user.id } },
  });
  if (!existing) return { success: false, error: "Etiqueta não encontrada" };

  // Os cards NÃO são apagados: só perdem o vínculo (cascade na tabela de junção).
  await prisma.taskLabel.delete({ where: { id } });

  revalidateTasks();
  return { success: true };
}

/** Liga/desliga uma etiqueta no card — usado pelos atalhos dentro do drawer. */
export async function toggleCardLabel(cardId: string, labelId: string): Promise<FormResult> {
  const user = await requireUser();
  const card = await findOwnedCard(user.id, cardId);
  if (!card) return { success: false, error: "Card não encontrado" };

  const label = await prisma.taskLabel.findFirst({
    where: { id: labelId, boardId: card.boardId },
  });
  if (!label) return { success: false, error: "Etiqueta não encontrada" };

  const link = await prisma.taskCardLabel.findUnique({
    where: { cardId_labelId: { cardId, labelId } },
  });

  if (link) {
    await prisma.taskCardLabel.delete({ where: { cardId_labelId: { cardId, labelId } } });
  } else {
    await prisma.taskCardLabel.create({ data: { cardId, labelId } });
  }

  await logActivity({
    boardId: card.boardId,
    cardId,
    userId: user.id,
    type: "LABELS_UPDATED",
    message: link ? `removeu a etiqueta "${label.name}"` : `adicionou a etiqueta "${label.name}"`,
  });

  revalidateTasks();
  return { success: true };
}

/* -------------------------------- Checklist ------------------------------- */

/**
 * As actions de criação do checklist devolvem o registro gravado.
 *
 * É o que permite a tela aplicar a mudança no próprio estado, sem uma segunda
 * viagem ao servidor só para descobrir o id que ela mesma acabou de criar.
 */
export type CreatedResult<T> = FormResult & { data?: T };

export async function addChecklist(
  cardId: string,
  title: string
): Promise<CreatedResult<ChecklistView>> {
  const user = await requireUser();
  const card = await findOwnedCard(user.id, cardId);
  if (!card) return { success: false, error: "Card não encontrado" };

  const clean = (title.trim() || "Checklist").slice(0, 100);
  const position = await prisma.checklist.count({ where: { cardId } });
  const created = await prisma.checklist.create({
    data: { cardId, title: clean, position },
  });

  await logActivity({
    boardId: card.boardId,
    cardId,
    userId: user.id,
    type: "CHECKLIST_UPDATED",
    message: `adicionou o checklist "${clean}"`,
  });

  revalidateTasks();
  return {
    success: true,
    data: { id: created.id, title: created.title, position: created.position, items: [] },
  };
}

export async function deleteChecklist(id: string): Promise<FormResult> {
  const user = await requireUser();
  const checklist = await prisma.checklist.findFirst({
    where: { id, card: { board: { userId: user.id } } },
    include: { card: { select: { id: true, boardId: true } } },
  });
  if (!checklist) return { success: false, error: "Checklist não encontrado" };

  await prisma.checklist.delete({ where: { id } });
  await logActivity({
    boardId: checklist.card.boardId,
    cardId: checklist.card.id,
    userId: user.id,
    type: "CHECKLIST_UPDATED",
    message: `removeu o checklist "${checklist.title}"`,
  });

  revalidateTasks();
  return { success: true };
}

export async function addChecklistItem(
  checklistId: string,
  content: string
): Promise<CreatedResult<ChecklistItemView>> {
  const user = await requireUser();

  const parsed = checklistItemSchema.safeParse({ content });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const checklist = await prisma.checklist.findFirst({
    where: { id: checklistId, card: { board: { userId: user.id } } },
    include: { card: { select: { id: true, boardId: true } } },
  });
  if (!checklist) return { success: false, error: "Checklist não encontrado" };

  const position = await prisma.checklistItem.count({ where: { checklistId } });
  const created = await prisma.checklistItem.create({
    data: { checklistId, content: parsed.data.content, position },
  });

  await logActivity({
    boardId: checklist.card.boardId,
    cardId: checklist.card.id,
    userId: user.id,
    type: "CHECKLIST_UPDATED",
    message: `adicionou "${parsed.data.content}" ao checklist`,
  });

  revalidateTasks();
  return {
    success: true,
    data: {
      id: created.id,
      content: created.content,
      done: created.done,
      position: created.position,
    },
  };
}

export async function updateChecklistItem(
  id: string,
  changes: { content?: string; done?: boolean }
): Promise<FormResult> {
  const user = await requireUser();

  const item = await prisma.checklistItem.findFirst({
    where: { id, checklist: { card: { board: { userId: user.id } } } },
    include: { checklist: { include: { card: { select: { id: true, boardId: true } } } } },
  });
  if (!item) return { success: false, error: "Item não encontrado" };

  const data: { content?: string; done?: boolean } = {};

  if (changes.content !== undefined) {
    const parsed = checklistItemSchema.safeParse({ content: changes.content });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };
    data.content = parsed.data.content;
  }
  if (changes.done !== undefined) data.done = changes.done;

  await prisma.checklistItem.update({ where: { id }, data });

  await logActivity({
    boardId: item.checklist.card.boardId,
    cardId: item.checklist.card.id,
    userId: user.id,
    type: "CHECKLIST_UPDATED",
    message:
      changes.done !== undefined
        ? `${changes.done ? "concluiu" : "reabriu"} "${data.content ?? item.content}"`
        : `editou o item "${item.content}"`,
  });

  revalidateTasks();
  return { success: true };
}

export async function deleteChecklistItem(id: string): Promise<FormResult> {
  const user = await requireUser();
  const item = await prisma.checklistItem.findFirst({
    where: { id, checklist: { card: { board: { userId: user.id } } } },
    include: { checklist: { include: { card: { select: { id: true, boardId: true } } } } },
  });
  if (!item) return { success: false, error: "Item não encontrado" };

  await prisma.checklistItem.delete({ where: { id } });
  await logActivity({
    boardId: item.checklist.card.boardId,
    cardId: item.checklist.card.id,
    userId: user.id,
    type: "CHECKLIST_UPDATED",
    message: `removeu "${item.content}" do checklist`,
  });

  revalidateTasks();
  return { success: true };
}

/* -------------------------------- Anotações ------------------------------- */

/** Janela em que edições seguidas da anotação contam como um evento só. */
const NOTES_ACTIVITY_WINDOW_MS = 10 * 60 * 1000;

/**
 * Grava as anotações do card. Chamada pelo salvamento automático.
 *
 * O histórico NÃO recebe uma linha por gravação: quem digita por dez minutos
 * dispara dezenas de salvamentos, e "anotações alteradas" repetido trinta vezes
 * não informa nada. Um evento por janela de dez minutos preserva o sinal.
 */
export async function saveCardNotes(cardId: string, content: string): Promise<FormResult> {
  const user = await requireUser();

  const parsed = cardNotesSchema.safeParse({ content });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const card = await findOwnedCard(user.id, cardId);
  if (!card) return { success: false, error: "Card não encontrado" };

  await prisma.taskNote.upsert({
    where: { cardId },
    create: { cardId, content: parsed.data.content },
    update: { content: parsed.data.content },
  });

  const recent = await prisma.taskActivity.findFirst({
    where: {
      cardId,
      type: "NOTES_UPDATED",
      createdAt: { gt: new Date(Date.now() - NOTES_ACTIVITY_WINDOW_MS) },
    },
    select: { id: true },
  });

  if (!recent) {
    await logActivity({
      boardId: card.boardId,
      cardId,
      userId: user.id,
      type: "NOTES_UPDATED",
      message: "atualizou as anotações",
    });
  }

  revalidateTasks();
  return { success: true };
}

/* --------------------------------- Leitura -------------------------------- */

/**
 * Conteúdo do drawer, buscado sob demanda quando um card é aberto.
 *
 * Mantém checklists, anotações e histórico fora da consulta do quadro, que
 * carrega todos os cards de todas as colunas de uma vez.
 */
export async function fetchCardDetail(cardId: string): Promise<CardDetailView | null> {
  const user = await requireUser();
  return getCardDetailView(user.id, cardId);
}
