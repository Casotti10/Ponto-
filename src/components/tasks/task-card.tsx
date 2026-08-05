"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  CheckSquare,
  Copy,
  GripVertical,
  MoreHorizontal,
  Pencil,
  StickyNote,
  Trash2,
  CornerUpRight,
  CircleCheck,
  CircleDashed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DUE_STATUS_CLASS,
  PRIORITY_META,
  checklistProgress,
  dueStatus,
} from "@/lib/task-calc";
import type { TaskCardView, TaskLabelView } from "@/lib/task-service";

interface Props {
  card: TaskCardView;
  labels: TaskLabelView[];
  /** Colunas do quadro, para o atalho "Mover para" — o caminho sem arrasto. */
  columns: { id: string; name: string }[];
  /** Este é o card em movimento: vira silhueta e reserva o espaço na lista. */
  isGhost?: boolean;
  /** Cópia que acompanha o ponteiro. Não recebe interação. */
  isOverlay?: boolean;
  onOpen?: (cardId: string) => void;
  onEdit?: (cardId: string) => void;
  onDuplicate?: (cardId: string) => void;
  onDelete?: (cardId: string) => void;
  onMoveTo?: (cardId: string, columnId: string) => void;
  onToggleComplete?: (cardId: string) => void;
  onDragHandlePointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
}

export function TaskCardItem({
  card,
  labels,
  columns,
  isGhost = false,
  isOverlay = false,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveTo,
  onToggleComplete,
  onDragHandlePointerDown,
}: Props) {
  const priority = PRIORITY_META[card.priority];
  const status = dueStatus(card.dueDate, card.completed);
  const progress = checklistProgress(card.checklistDone, card.checklistTotal);
  const cardLabels = labels.filter((label) => card.labelIds.includes(label.id));

  /** Evita que interagir com o menu ou a caixa de concluir inicie um arrasto. */
  const stopDrag = (event: React.PointerEvent) => event.stopPropagation();

  return (
    <article
      data-card-id={card.id}
      // No mouse o card inteiro é pegável. No toque, NÃO: o dedo no corpo do
      // card precisa continuar rolando a lista, e o navegador não devolve o
      // gesto depois que decidiu que aquilo era rolagem. Em telas de toque o
      // arrasto sai pela alça, que é `touch-none`.
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") onDragHandlePointerDown?.(event);
      }}
      onClick={() => onOpen?.(card.id)}
      className={cn(
        "group/card relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200",
        !isOverlay && !isGhost && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        // A silhueta mantém a altura exata do card para que a lista não pule
        // quando ele começa a ser arrastado.
        isGhost && "border-dashed opacity-40 shadow-none",
        isOverlay && "w-full rotate-2 cursor-grabbing shadow-xl ring-2 ring-primary/30",
        card.completed && !isGhost && "opacity-75"
      )}
    >
      {/* Cor personalizada: faixa no topo, como a capa de um card do Trello. */}
      {card.color && <span className="h-1.5 w-full shrink-0" style={{ backgroundColor: card.color }} />}

      <div className="flex flex-col gap-2 p-3">
        {cardLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {cardLabels.map((label) => (
              <span
                key={label.id}
                title={label.name}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-start gap-1.5">
          {!isOverlay && (
            <button
              type="button"
              aria-label={card.completed ? "Reabrir tarefa" : "Concluir tarefa"}
              onPointerDown={stopDrag}
              onClick={(event) => {
                event.stopPropagation();
                onToggleComplete?.(card.id);
              }}
              className={cn(
                "mt-0.5 shrink-0 rounded transition-colors",
                card.completed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground/50 hover:text-foreground"
              )}
            >
              {card.completed ? (
                <CircleCheck className="h-4 w-4" />
              ) : (
                <CircleDashed className="h-4 w-4" />
              )}
            </button>
          )}

          <p
            className={cn(
              "min-w-0 flex-1 text-sm leading-snug font-medium break-words",
              card.completed && "text-muted-foreground line-through"
            )}
          >
            {card.title}
          </p>

          {!isOverlay && (
            <div className="flex shrink-0 items-center" onPointerDown={stopDrag}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Ações do card ${card.title}`}
                      onClick={(event) => event.stopPropagation()}
                      className="opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onEdit?.(card.id)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate?.(card.id)}>
                    <Copy className="mr-2 h-4 w-4" /> Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* Alternativa ao arrasto — funciona no teclado e é o caminho
                      mais confortável em telas pequenas. */}
                  {columns
                    .filter((column) => column.id !== card.columnId)
                    .map((column) => (
                      <DropdownMenuItem
                        key={column.id}
                        onClick={() => onMoveTo?.(card.id, column.id)}
                      >
                        <CornerUpRight className="mr-2 h-4 w-4" /> Mover para {column.name}
                      </DropdownMenuItem>
                    ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete?.(card.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Alça de arrasto. `touch-none` é o que impede o navegador de
                  interpretar o gesto como rolagem da lista no celular. */}
              <span
                aria-hidden
                onPointerDown={onDragHandlePointerDown}
                className="touch-none cursor-grab rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" />
              </span>
            </div>
          )}
        </div>

        {card.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {card.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1" title={`Prioridade ${priority.label}`}>
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: priority.color }}
              aria-hidden
            />
            {priority.label}
          </span>

          {card.dueDate && (
            <span
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 font-medium",
                DUE_STATUS_CLASS[status]
              )}
              title={status === "overdue" ? "Vencida" : "Data de vencimento"}
            >
              <CalendarClock className="h-3 w-3" />
              {format(new Date(card.dueDate), "dd MMM", { locale: ptBR })}
            </span>
          )}

          {progress.total > 0 && (
            <span
              className={cn(
                "flex items-center gap-1",
                progress.done === progress.total && "text-emerald-600 dark:text-emerald-400"
              )}
              title={progress.label}
            >
              <CheckSquare className="h-3 w-3" />
              {progress.done}/{progress.total}
            </span>
          )}

          {card.hasNotes && (
            <span className="flex items-center gap-1" title="Tem anotações">
              <StickyNote className="h-3 w-3" />
            </span>
          )}
        </div>

        {progress.total > 0 && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        )}
      </div>
    </article>
  );
}
