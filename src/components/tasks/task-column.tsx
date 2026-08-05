"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskCardItem } from "@/components/tasks/task-card";
import type { BoardColumnView, TaskCardView, TaskLabelView } from "@/lib/task-service";

interface Props {
  column: BoardColumnView;
  /** Cards já filtrados e ordenados pela barra de ferramentas. */
  cards: TaskCardView[];
  /** Total real da coluna, para o contador não mentir quando há filtro ativo. */
  totalCards: number;
  labels: TaskLabelView[];
  columns: { id: string; name: string }[];
  draggingCardId: string | null;
  /** Coluna sob o ponteiro durante um arrasto — recebe o realce de alvo. */
  isDropTarget: boolean;
  registerColumn: (el: HTMLElement | null) => void;
  registerList: (el: HTMLElement | null) => void;
  onCardPointerDown: (
    event: React.PointerEvent<HTMLElement>,
    card: { cardId: string; columnId: string; index: number }
  ) => void;
  onOpenCard: (cardId: string) => void;
  onEditCard: (cardId: string) => void;
  onDuplicateCard: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onMoveCardTo: (cardId: string, columnId: string) => void;
  onToggleComplete: (cardId: string) => void;
  onAddCard: (columnId: string) => void;
  onEditColumn: (column: BoardColumnView) => void;
  onDeleteColumn: (column: BoardColumnView) => void;
}

export function TaskColumn({
  column,
  cards,
  totalCards,
  labels,
  columns,
  draggingCardId,
  isDropTarget,
  registerColumn,
  registerList,
  onCardPointerDown,
  onOpenCard,
  onEditCard,
  onDuplicateCard,
  onDeleteCard,
  onMoveCardTo,
  onToggleComplete,
  onAddCard,
  onEditColumn,
  onDeleteColumn,
}: Props) {
  const hidden = totalCards - cards.length;

  return (
    <section
      ref={registerColumn}
      aria-label={`Coluna ${column.name}`}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors duration-200 sm:w-80",
        isDropTarget && "border-primary/40 bg-primary/5"
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: column.color }}
          aria-hidden
        />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{column.name}</h2>

        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {hidden > 0 ? `${cards.length}/${totalCards}` : totalCards}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Ações da coluna ${column.name}`}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAddCard(column.id)}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar card
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEditColumn(column)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar coluna
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => onDeleteColumn(column)}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir coluna
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div
        ref={registerList}
        className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 lg:max-h-[calc(100vh-20rem)]"
      >
        {cards.length === 0 && (
          <p
            className={cn(
              "rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground transition-colors",
              isDropTarget && "border-primary/50 text-primary"
            )}
          >
            {totalCards === 0 ? "Nenhum card aqui" : "Nenhum card corresponde ao filtro"}
          </p>
        )}

        {cards.map((card, index) => (
          <TaskCardItem
            key={card.id}
            card={card}
            labels={labels}
            columns={columns}
            isGhost={draggingCardId === card.id}
            onOpen={onOpenCard}
            onEdit={onEditCard}
            onDuplicate={onDuplicateCard}
            onDelete={onDeleteCard}
            onMoveTo={onMoveCardTo}
            onToggleComplete={onToggleComplete}
            onDragHandlePointerDown={(event) =>
              onCardPointerDown(event, { cardId: card.id, columnId: column.id, index })
            }
          />
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="m-2 mt-0 justify-start gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => onAddCard(column.id)}
      >
        <Plus className="h-4 w-4" /> Adicionar card
      </Button>
    </section>
  );
}
