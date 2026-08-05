"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BoardToolbar } from "@/components/tasks/board-toolbar";
import { TaskColumn } from "@/components/tasks/task-column";
import { TaskCardItem } from "@/components/tasks/task-card";
import { CardDetailSheet } from "@/components/tasks/card-detail-sheet";
import { CardFormDialog, type CardFormValues } from "@/components/tasks/card-form-dialog";
import { ColumnFormDialog, type ColumnFormValues } from "@/components/tasks/column-form-dialog";
import { LabelManager } from "@/components/tasks/label-manager";
import { useBoardDnd } from "@/components/tasks/use-board-dnd";
import {
  EMPTY_FILTERS,
  filterCards,
  sortCards,
  type CardFilters,
  type SortMode,
} from "@/lib/task-calc";
import {
  deleteCard,
  deleteColumn,
  duplicateCard,
  moveCard,
  toggleCardCompleted,
} from "@/lib/actions/tasks";
import type { BoardColumnView, TaskLabelView } from "@/lib/task-service";

interface Props {
  boardId: string;
  columns: BoardColumnView[];
  labels: TaskLabelView[];
}

type Confirmation =
  | { kind: "card"; id: string; name: string }
  | { kind: "column"; id: string; name: string; cardCount: number };

const NEW_CARD_DEFAULTS = {
  title: "",
  description: "",
  priority: "MEDIA" as const,
  dueDate: "",
  color: "",
  labelIds: [] as string[],
};

/**
 * Orquestra o quadro: estado local do arrasto, filtros e todos os diálogos.
 *
 * O estado das colunas é uma CÓPIA do que veio do servidor. Durante o arrasto a
 * cópia é reordenada a cada quadro de animação — é ela que dá a prévia — e a
 * gravação acontece só ao soltar. Quando a action revalida a página, o servidor
 * volta a mandar a verdade e a cópia é substituída.
 */
export function TaskBoard({ boardId, columns: serverColumns, labels }: Props) {
  const [columns, setColumns] = useState(serverColumns);
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortMode>("manual");
  const [, startTransition] = useTransition();

  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState<{ open: boolean; values: CardFormValues } | null>(null);
  const [columnForm, setColumnForm] = useState<{ open: boolean; values: ColumnFormValues } | null>(
    null
  );
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  // Última verdade do servidor, para desfazer um arrasto que falhou ao gravar.
  const serverColumnsRef = useRef(serverColumns);

  // Enquanto o card está no ar, a cópia local é a única fonte da prévia: aceitar
  // uma atualização do servidor aqui faria o card voltar para o lugar antigo no
  // meio do gesto.
  useEffect(() => {
    serverColumnsRef.current = serverColumns;
    if (!draggingRef.current) setColumns(serverColumns);
  }, [serverColumns]);

  const columnOptions = useMemo(
    () => columns.map((column) => ({ id: column.id, name: column.name })),
    [columns]
  );

  const allCards = useMemo(() => columns.flatMap((column) => column.cards), [columns]);

  /* ------------------------------- Arrasto -------------------------------- */

  const applyLocalMove = useCallback((cardId: string, toColumnId: string, toIndex: number) => {
    setColumns((current) => {
      const from = current.find((column) => column.cards.some((card) => card.id === cardId));
      const card = from?.cards.find((item) => item.id === cardId);
      if (!from || !card) return current;

      const moved = { ...card, columnId: toColumnId };

      return current.map((column) => {
        if (column.id === from.id && column.id === toColumnId) {
          const rest = column.cards.filter((item) => item.id !== cardId);
          rest.splice(Math.min(toIndex, rest.length), 0, moved);
          return { ...column, cards: rest };
        }
        if (column.id === from.id) {
          return { ...column, cards: column.cards.filter((item) => item.id !== cardId) };
        }
        if (column.id === toColumnId) {
          const rest = [...column.cards];
          rest.splice(Math.min(toIndex, rest.length), 0, moved);
          return { ...column, cards: rest };
        }
        return column;
      });
    });
  }, []);

  const handleDrop = useCallback(
    (cardId: string, toColumnId: string, toIndex: number) => {
      startTransition(async () => {
        const result = await moveCard(cardId, toColumnId, toIndex);
        if (!result.success) {
          // A prévia já mostrou o card no lugar novo; sem este retorno a tela
          // ficaria mentindo sobre o que está gravado.
          setColumns(serverColumnsRef.current);
          toast.error(result.error ?? "Não foi possível mover o card");
        }
      });
    },
    []
  );

  const { drag, startCardDrag, registerColumn, registerList, consumeClickSuppression } =
    useBoardDnd({
      onMove: applyLocalMove,
      onDrop: handleDrop,
      scrollerRef,
    });

  const draggedCard = drag ? allCards.find((card) => card.id === drag.cardId) ?? null : null;

  // A trava de sincronia segue o arrasto DE FATO ativo, e não o pointerdown: um
  // clique simples também dispara pointerdown, e marcá-la ali deixaria a tela
  // para sempre surda às atualizações do servidor.
  useEffect(() => {
    draggingRef.current = drag !== null;
  }, [drag]);

  const handleCardPointerDown = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      card: { cardId: string; columnId: string; index: number }
    ) => {
      // Fora da ordem manual, os índices na tela não correspondem a `position`:
      // gravar um arrasto ali produziria uma ordem que ninguém pediu.
      if (sort !== "manual") return;
      startCardDrag(event, card);
    },
    [sort, startCardDrag]
  );

  /* -------------------------------- Ações --------------------------------- */

  function runAction(action: () => Promise<{ success: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.success) toast.success(success);
      else toast.error(result.error ?? "Não foi possível concluir a ação");
    });
  }

  function openCard(cardId: string) {
    // Soltar um card dispara um clique logo depois; sem isto o drawer abriria
    // sozinho ao fim de todo arrasto.
    if (consumeClickSuppression()) return;
    setOpenCardId(cardId);
  }

  function openNewCard(columnId: string) {
    setCardForm({ open: true, values: { columnId, ...NEW_CARD_DEFAULTS } });
  }

  function openEditCard(cardId: string) {
    const card = allCards.find((item) => item.id === cardId);
    if (!card) return;
    setCardForm({
      open: true,
      values: {
        id: card.id,
        columnId: card.columnId,
        title: card.title,
        description: card.description ?? "",
        priority: card.priority,
        dueDate: card.dueDate ? format(new Date(card.dueDate), "yyyy-MM-dd") : "",
        color: card.color ?? "",
        labelIds: card.labelIds,
      },
    });
  }

  function requestDeleteCard(cardId: string) {
    const card = allCards.find((item) => item.id === cardId);
    if (card) setConfirmation({ kind: "card", id: card.id, name: card.title });
  }

  function requestDeleteColumn(column: BoardColumnView) {
    setConfirmation({
      kind: "column",
      id: column.id,
      name: column.name,
      cardCount: column.cards.length,
    });
  }

  function confirmDeletion() {
    if (!confirmation) return;
    const target = confirmation;
    setConfirmation(null);

    if (target.kind === "card") {
      if (openCardId === target.id) setOpenCardId(null);
      runAction(() => deleteCard(target.id), "Card excluído");
    } else {
      runAction(() => deleteColumn(target.id), "Coluna excluída");
    }
  }

  // Derivado, e não guardado: se o card sumir (excluído aqui ou em outra aba),
  // `openedCard` vira nulo e o drawer fecha sozinho.
  const openedCard = openCardId ? allCards.find((card) => card.id === openCardId) ?? null : null;

  const visibleCount = useMemo(
    () => columns.reduce((total, column) => total + filterCards(column.cards, filters).length, 0),
    [columns, filters]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BoardToolbar
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          labels={labels}
          visibleCount={visibleCount}
          totalCount={allCards.length}
        />

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => setLabelsOpen(true)}>
            <Tag className="h-4 w-4" /> Etiquetas
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              setColumnForm({
                open: true,
                values: { name: "", color: "#898781", isDone: false },
              })
            }
          >
            <Plus className="h-4 w-4" /> Nova coluna
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex items-start gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]"
      >
        {columns.map((column) => (
          <TaskColumn
            key={column.id}
            column={column}
            cards={sortCards(filterCards(column.cards, filters), sort)}
            totalCards={column.cards.length}
            labels={labels}
            columns={columnOptions}
            draggingCardId={drag?.cardId ?? null}
            isDropTarget={drag?.target.columnId === column.id}
            registerColumn={registerColumn(column.id)}
            registerList={registerList(column.id)}
            onCardPointerDown={handleCardPointerDown}
            onOpenCard={openCard}
            onEditCard={openEditCard}
            onDuplicateCard={(cardId) => runAction(() => duplicateCard(cardId), "Card duplicado")}
            onDeleteCard={requestDeleteCard}
            onMoveCardTo={(cardId, columnId) =>
              runAction(() => moveCard(cardId, columnId, 0), "Card movido")
            }
            onToggleComplete={(cardId) =>
              runAction(() => toggleCardCompleted(cardId), "Tarefa atualizada")
            }
            onAddCard={openNewCard}
            onEditColumn={(item) =>
              setColumnForm({
                open: true,
                values: {
                  id: item.id,
                  name: item.name,
                  color: item.color,
                  isDone: item.isDone,
                },
              })
            }
            onDeleteColumn={requestDeleteColumn}
          />
        ))}

        <Button
          variant="outline"
          className="h-11 w-64 shrink-0 justify-start gap-1.5 border-dashed text-muted-foreground"
          onClick={() =>
            setColumnForm({ open: true, values: { name: "", color: "#898781", isDone: false } })
          }
        >
          <Plus className="h-4 w-4" /> Adicionar coluna
        </Button>
      </div>

      {/* Prévia que acompanha o ponteiro. Fica fora do fluxo e sem eventos para
          não interferir na medição do alvo. */}
      {drag && draggedCard && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: drag.x, top: drag.y, width: drag.width }}
        >
          <TaskCardItem card={draggedCard} labels={labels} columns={columnOptions} isOverlay />
        </div>
      )}

      <CardDetailSheet
        card={openedCard}
        open={!!openedCard}
        onOpenChange={(value) => !value && setOpenCardId(null)}
        columns={columnOptions}
        labels={labels}
        onEdit={openEditCard}
        onDuplicate={(cardId) => runAction(() => duplicateCard(cardId), "Card duplicado")}
        onDelete={requestDeleteCard}
      />

      {cardForm && (
        <CardFormDialog
          // Remonta a cada card para que a seleção de etiquetas e os campos não
          // controlados partam sempre dos valores do card que está sendo aberto.
          key={cardForm.values.id ?? `novo-${cardForm.values.columnId}`}
          open={cardForm.open}
          onOpenChange={(value) => setCardForm(value ? cardForm : null)}
          columns={columnOptions}
          labels={labels}
          initialValues={cardForm.values}
        />
      )}

      {columnForm && (
        <ColumnFormDialog
          open={columnForm.open}
          onOpenChange={(value) => setColumnForm(value ? columnForm : null)}
          boardId={boardId}
          initialValues={columnForm.values}
        />
      )}

      <LabelManager
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        boardId={boardId}
        labels={labels}
      />

      <AlertDialog open={!!confirmation} onOpenChange={(value) => !value && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.kind === "column" ? "Excluir coluna?" : "Excluir card?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.kind === "column"
                ? confirmation.cardCount > 0
                  ? `"${confirmation.name}" ainda tem ${confirmation.cardCount} card(s). Mova-os para outra coluna antes de excluir.`
                  : `A coluna "${confirmation.name}" será removida do quadro.`
                : `O card "${confirmation?.name}" será excluído com seus checklists e anotações. A exclusão fica registrada no histórico do quadro.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletion}
              disabled={confirmation?.kind === "column" && confirmation.cardCount > 0}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
