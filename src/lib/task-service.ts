import { prisma } from "@/lib/prisma";
import type { TaskPriority } from "@prisma/client";

/**
 * Camada de acesso a dados do quadro de tarefas.
 *
 * Segue o desenho de `src/lib/ledger-service.ts`: aqui ficam as consultas ao
 * Prisma e a serialização para o cliente; as regras puras moram em
 * `src/lib/task-calc.ts`.
 *
 * Datas saem daqui como string ISO. Os componentes do quadro são de cliente e
 * fazem cópia local do estado para o arrasto otimista — string atravessa essa
 * fronteira sem virar `Date` de um lado e objeto serializado do outro.
 */

/* --------------------------------- Tipos ---------------------------------- */

export interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
}

export interface TaskLabelView {
  id: string;
  name: string;
  color: string;
}

export interface TaskCardView {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  color: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  position: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  labelIds: string[];
  checklistTotal: number;
  checklistDone: number;
  /** Só o suficiente para o ícone de "tem anotação" no card, sem carregar o texto. */
  hasNotes: boolean;
  assignee: { id: string; name: string; avatarColor: string } | null;
}

export interface BoardColumnView {
  id: string;
  name: string;
  color: string;
  position: number;
  isDone: boolean;
  cards: TaskCardView[];
}

export interface BoardView {
  board: BoardSummary;
  boards: BoardSummary[];
  columns: BoardColumnView[];
  labels: TaskLabelView[];
}

export interface ChecklistItemView {
  id: string;
  content: string;
  done: boolean;
  position: number;
}

export interface ChecklistView {
  id: string;
  title: string;
  position: number;
  items: ChecklistItemView[];
}

export interface ActivityView {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  userName: string;
}

export interface CardDetailView {
  id: string;
  checklists: ChecklistView[];
  notes: string;
  activities: ActivityView[];
}

/* -------------------------------- Bootstrap -------------------------------- */

const DEFAULT_COLUMNS: { name: string; color: string; isDone: boolean }[] = [
  { name: "A Fazer", color: "#898781", isDone: false },
  { name: "Em Andamento", color: "#2a78d6", isDone: false },
  { name: "Em Revisão", color: "#eda100", isDone: false },
  { name: "Concluído", color: "#1baf7a", isDone: true },
];

/** Etiquetas iniciais, nas primeiras posições da paleta validada. */
const DEFAULT_LABELS: { name: string; color: string }[] = [
  { name: "Trabalho", color: "#2a78d6" },
  { name: "Pessoal", color: "#1baf7a" },
  { name: "Urgente", color: "#e34948" },
  { name: "Ideia", color: "#4a3aa7" },
];

/**
 * Garante que o usuário tenha um quadro para abrir na primeira visita.
 *
 * Só age quando NÃO existe nenhum quadro: um usuário que apagou todas as
 * colunas de propósito não as vê voltar na próxima navegação.
 */
export async function ensureBoardBootstrap(userId: string): Promise<string> {
  const existing = await prisma.board.findFirst({
    where: { userId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (existing) return existing.id;

  const board = await prisma.board.create({
    data: {
      userId,
      name: "Meu quadro",
      description: "Organize suas tarefas arrastando os cards entre as colunas.",
      columns: {
        create: DEFAULT_COLUMNS.map((column, index) => ({ ...column, position: index })),
      },
      labels: { create: DEFAULT_LABELS },
    },
    select: { id: true },
  });

  return board.id;
}

/* ------------------------------- Consultas -------------------------------- */

/**
 * Resolve qual quadro exibir e confirma a posse na mesma consulta.
 *
 * Um `boardId` que não seja do usuário cai no quadro padrão dele em vez de
 * devolver erro — a URL é editável à mão e o caso não é um ataque, é um link
 * velho. O que não pode acontecer é abrir o quadro de outra pessoa.
 */
export async function resolveBoardId(userId: string, requestedId?: string | null) {
  if (requestedId) {
    const owned = await prisma.board.findFirst({
      where: { id: requestedId, userId },
      select: { id: true },
    });
    if (owned) return owned.id;
  }
  return ensureBoardBootstrap(userId);
}

/**
 * Monta o quadro inteiro em uma consulta.
 *
 * O que NÃO vem aqui é proposital: o texto das anotações, os itens de checklist
 * e o histórico só são lidos quando um card é aberto (`getCardDetail`). Do
 * checklist basta a contagem, que sai de `_count` sem trazer as linhas.
 */
export async function getBoardView(userId: string, boardId: string): Promise<BoardView> {
  const [board, boards] = await Promise.all([
    prisma.board.findFirst({
      where: { id: boardId, userId },
      include: {
        labels: { orderBy: { createdAt: "asc" } },
        columns: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
              include: {
                labels: { select: { labelId: true } },
                note: { select: { content: true } },
                assignee: { select: { id: true, name: true, avatarColor: true } },
                checklists: { select: { items: { select: { done: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.board.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, description: true },
    }),
  ]);

  if (!board) throw new Error("BOARD_NOT_FOUND");

  return {
    board: { id: board.id, name: board.name, description: board.description },
    boards,
    labels: board.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    })),
    columns: board.columns.map((column) => ({
      id: column.id,
      name: column.name,
      color: column.color,
      position: column.position,
      isDone: column.isDone,
      cards: column.cards.map((card) => {
        const items = card.checklists.flatMap((checklist) => checklist.items);
        return {
          id: card.id,
          columnId: card.columnId,
          title: card.title,
          description: card.description,
          color: card.color,
          priority: card.priority,
          dueDate: card.dueDate ? card.dueDate.toISOString() : null,
          position: card.position,
          completed: card.completed,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
          labelIds: card.labels.map((link) => link.labelId),
          checklistTotal: items.length,
          checklistDone: items.filter((item) => item.done).length,
          hasNotes: (card.note?.content.trim().length ?? 0) > 0,
          assignee: card.assignee,
        };
      }),
    })),
  };
}

/** Conteúdo pesado do card, carregado só quando o drawer abre. */
export async function getCardDetailView(
  userId: string,
  cardId: string
): Promise<CardDetailView | null> {
  const card = await prisma.taskCard.findFirst({
    where: { id: cardId, board: { userId } },
    include: {
      note: true,
      checklists: {
        orderBy: { position: "asc" },
        include: { items: { orderBy: { position: "asc" } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!card) return null;

  return {
    id: card.id,
    notes: card.note?.content ?? "",
    checklists: card.checklists.map((checklist) => ({
      id: checklist.id,
      title: checklist.title,
      position: checklist.position,
      items: checklist.items.map((item) => ({
        id: item.id,
        content: item.content,
        done: item.done,
        position: item.position,
      })),
    })),
    activities: card.activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      message: activity.message,
      createdAt: activity.createdAt.toISOString(),
      userName: activity.user.name,
    })),
  };
}

/** Estatísticas do topo da página. Contagens, sem trazer os cards de novo. */
export async function getBoardStats(boardId: string, today: Date = new Date()) {
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  const [total, completed, overdue, urgent] = await Promise.all([
    prisma.taskCard.count({ where: { boardId } }),
    prisma.taskCard.count({ where: { boardId, completed: true } }),
    prisma.taskCard.count({
      where: { boardId, completed: false, dueDate: { lt: endOfToday } },
    }),
    prisma.taskCard.count({ where: { boardId, completed: false, priority: "URGENTE" } }),
  ]);

  return { total, completed, overdue, urgent, open: total - completed };
}
