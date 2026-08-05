import { differenceInCalendarDays, startOfDay } from "date-fns";
import type { TaskPriority } from "@prisma/client";
import { categoryPalette, categoryFallbackColor } from "@/lib/chart-colors";

/**
 * Regras puras do quadro de tarefas.
 *
 * Segue o desenho de `src/lib/ledger-calc.ts`: aqui não há Prisma nem React —
 * só funções determinísticas. É o que permite a mesma ordenação e o mesmo
 * cálculo de progresso rodarem no servidor (consulta) e no cliente (filtro
 * local, prévia do arrasto) sem duas implementações que podem divergir.
 */

/* -------------------------------- Prioridade ------------------------------- */

export interface PriorityMeta {
  label: string;
  /** Cor da faixa lateral e do ponto de prioridade. Vem da paleta validada. */
  color: string;
  /** Peso para ordenação decrescente: Urgente primeiro. */
  weight: number;
  /** Classes do badge, em tons que funcionam nos dois temas. */
  badgeClass: string;
}

export const PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
  URGENTE: {
    label: "Urgente",
    color: categoryPalette.light[1], // #e34948
    weight: 3,
    badgeClass:
      "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900",
  },
  ALTA: {
    label: "Alta",
    color: categoryPalette.light[3], // #eda100
    weight: 2,
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  },
  MEDIA: {
    label: "Média",
    color: categoryPalette.light[0], // #2a78d6
    weight: 1,
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  },
  BAIXA: {
    label: "Baixa",
    color: categoryFallbackColor.light, // #898781
    weight: 0,
    badgeClass:
      "bg-muted text-muted-foreground border-border",
  },
};

/** Ordem de exibição nos seletores: do mais grave para o mais leve. */
export const PRIORITY_ORDER: TaskPriority[] = ["URGENTE", "ALTA", "MEDIA", "BAIXA"];

/* ---------------------------------- Cores ---------------------------------- */

/**
 * Cores oferecidas para cards, colunas e etiquetas.
 *
 * É a mesma paleta categórica verificada usada nos gráficos do financeiro
 * (`src/lib/chart-colors.ts`) — cor escolhida à mão quebraria a garantia de
 * contraste e de separação sob daltonismo que ela tem.
 */
export const TASK_PALETTE: string[] = [...categoryPalette.light, categoryFallbackColor.light];

/* -------------------------------- Checklist -------------------------------- */

export interface ChecklistProgress {
  done: number;
  total: number;
  percent: number;
  /** "3 de 5 tarefas concluídas (60%)" */
  label: string;
}

export function checklistProgress(done: number, total: number): ChecklistProgress {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return {
    done,
    total,
    percent,
    label:
      total === 0
        ? "Nenhum item no checklist"
        : `${done} de ${total} ${total === 1 ? "item concluído" : "itens concluídos"} (${percent}%)`,
  };
}

/* ------------------------------ Data de entrega ---------------------------- */

export type DueStatus = "none" | "done" | "overdue" | "today" | "soon" | "future";

/**
 * Classifica o vencimento em relação a hoje.
 *
 * Compara DIAS de calendário, não milissegundos: uma tarefa que vence hoje às
 * 08:00 continua sendo "hoje" às 18:00, e não "atrasada há 10 horas".
 */
export function dueStatus(
  dueDate: Date | string | null | undefined,
  completed = false,
  today: Date = new Date()
): DueStatus {
  if (!dueDate) return "none";
  if (completed) return "done";

  const diff = differenceInCalendarDays(startOfDay(new Date(dueDate)), startOfDay(today));
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 2) return "soon";
  return "future";
}

export const DUE_STATUS_CLASS: Record<DueStatus, string> = {
  none: "",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  today: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  soon: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  future: "bg-muted text-muted-foreground",
};

/* ------------------------------- Reordenação ------------------------------- */

/**
 * Move um item de uma lista de ids para outra posição — o mesmo cálculo que o
 * arrasto faz na tela e que a action repete no servidor.
 *
 * Retorna listas novas; nada é mutado. `toIndex` é grampeado ao tamanho da
 * lista de destino para que um índice fora de faixa vindo do cliente vire
 * "no fim", em vez de furo na ordenação.
 */
export function moveId(
  source: string[],
  destination: string[],
  id: string,
  toIndex: number
): { source: string[]; destination: string[] } {
  const sameList = source === destination;
  const nextSource = source.filter((item) => item !== id);
  const nextDestination = sameList ? nextSource : destination.filter((item) => item !== id);

  const index = Math.max(0, Math.min(toIndex, nextDestination.length));
  nextDestination.splice(index, 0, id);

  return sameList
    ? { source: nextDestination, destination: nextDestination }
    : { source: nextSource, destination: nextDestination };
}

/**
 * Converte uma ordem de ids em gravações de `position`, devolvendo SÓ as linhas
 * que de fato mudaram.
 *
 * Reescrever a coluna inteira a cada arrasto seria correto e simples, mas gera
 * uma UPDATE por card em toda mexida. Como a ordem já vem pronta, comparar com
 * a posição atual custa nada e costuma reduzir o lote a duas ou três linhas.
 */
export function positionUpdates(
  orderedIds: string[],
  currentPositions: Map<string, number>
): { id: string; position: number }[] {
  const updates: { id: string; position: number }[] = [];
  orderedIds.forEach((id, index) => {
    if (currentPositions.get(id) !== index) updates.push({ id, position: index });
  });
  return updates;
}

/* --------------------------- Filtros e ordenação --------------------------- */

export type SortMode = "manual" | "priority" | "dueDate" | "createdAt" | "title";

export const SORT_LABELS: Record<SortMode, string> = {
  manual: "Ordem manual",
  priority: "Prioridade",
  dueDate: "Data de vencimento",
  createdAt: "Data de criação",
  title: "Título (A–Z)",
};

/** O mínimo que `filterCards` e `sortCards` precisam saber sobre um card. */
export interface SortableCard {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  position: number;
  labelIds: string[];
}

export interface CardFilters {
  search: string;
  priorities: TaskPriority[];
  labelIds: string[];
}

export const EMPTY_FILTERS: CardFilters = { search: "", priorities: [], labelIds: [] };

export function hasActiveFilters(filters: CardFilters) {
  return (
    filters.search.trim().length > 0 ||
    filters.priorities.length > 0 ||
    filters.labelIds.length > 0
  );
}

/** Normaliza para busca: minúsculas e sem acento, para "revisao" achar "Revisão". */
function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function filterCards<T extends SortableCard>(cards: T[], filters: CardFilters): T[] {
  const term = normalize(filters.search.trim());

  return cards.filter((card) => {
    if (term) {
      // A descrição entra na busca porque o título de um card costuma ser curto
      // demais para carregar sozinho o que a tarefa é.
      const haystack = normalize(`${card.title} ${card.description ?? ""}`);
      if (!haystack.includes(term)) return false;
    }
    if (filters.priorities.length > 0 && !filters.priorities.includes(card.priority)) return false;
    if (
      filters.labelIds.length > 0 &&
      !filters.labelIds.some((labelId) => card.labelIds.includes(labelId))
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Ordena sem mutar a lista recebida.
 *
 * Em todos os modos que não são "manual", a posição manual continua sendo o
 * critério de desempate — assim a ordenação por prioridade não embaralha
 * arbitrariamente os cards de mesma prioridade a cada renderização.
 */
export function sortCards<T extends SortableCard>(cards: T[], mode: SortMode): T[] {
  const list = [...cards];

  switch (mode) {
    case "priority":
      return list.sort(
        (a, b) =>
          PRIORITY_META[b.priority].weight - PRIORITY_META[a.priority].weight ||
          a.position - b.position
      );
    case "dueDate":
      // Card sem vencimento vai para o fim: ordenar por data é uma pergunta
      // sobre prazo, e quem não tem prazo não compete por ele.
      return list.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return a.position - b.position;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate) || a.position - b.position;
      });
    case "createdAt":
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    case "manual":
    default:
      return list.sort((a, b) => a.position - b.position);
  }
}
