"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarClock, Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChecklistSection } from "@/components/tasks/checklist-section";
import { CardNotes } from "@/components/tasks/card-notes";
import { CardActivity } from "@/components/tasks/card-activity";
import { TaskColorPicker } from "@/components/tasks/task-color-picker";
import { fetchCardDetail, saveCard, toggleCardLabel } from "@/lib/actions/tasks";
import {
  DUE_STATUS_CLASS,
  PRIORITY_META,
  PRIORITY_ORDER,
  dueStatus,
} from "@/lib/task-calc";
import type { CardDetailView, TaskCardView, TaskLabelView } from "@/lib/task-service";
import type { TaskPriority } from "@prisma/client";

interface Props {
  card: TaskCardView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: { id: string; name: string }[];
  labels: TaskLabelView[];
  onEdit: (cardId: string) => void;
  onDuplicate: (cardId: string) => void;
  onDelete: (cardId: string) => void;
}

/** Data local em `yyyy-MM-dd`, que é o formato do `<input type="date">`. */
function toDateInput(iso: string | null) {
  return iso ? format(new Date(iso), "yyyy-MM-dd") : "";
}

/**
 * Monta o FormData completo do card com uma alteração aplicada por cima.
 *
 * As edições rápidas do drawer reaproveitam a action `saveCard` em vez de
 * ganharem uma action própria por campo: uma única porta de escrita significa
 * uma única validação e um único ponto onde o histórico é registrado.
 */
function buildCardFormData(
  card: TaskCardView,
  patch: Partial<{
    columnId: string;
    priority: TaskPriority;
    dueDate: string;
    color: string;
  }>
) {
  const formData = new FormData();
  formData.set("id", card.id);
  formData.set("columnId", patch.columnId ?? card.columnId);
  formData.set("title", card.title);
  formData.set("description", card.description ?? "");
  formData.set("priority", patch.priority ?? card.priority);
  formData.set("dueDate", patch.dueDate ?? toDateInput(card.dueDate));
  formData.set("color", patch.color ?? card.color ?? "");
  formData.set("labelIds", card.labelIds.join(","));
  return formData;
}

export function CardDetailSheet({
  card,
  open,
  onOpenChange,
  columns,
  labels,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const [detail, setDetail] = useState<CardDetailView | null>(null);
  const [pending, startTransition] = useTransition();

  const cardId = card?.id ?? null;

  /**
   * Checklists, anotações e histórico ficam fora da consulta do quadro e são
   * buscados só quando o card é aberto de fato.
   *
   * `cancelled` cobre a troca rápida de card: sem ele, a resposta do card
   * anterior poderia chegar depois e sobrescrever a do card já aberto.
   */
  useEffect(() => {
    if (!open || !cardId) return;

    let cancelled = false;
    void (async () => {
      const result = await fetchCardDetail(cardId);
      if (cancelled) return;
      // Card que sumiu entre abrir o drawer e a resposta chegar vira um detalhe
      // vazio, e não um carregamento eterno — o quadro remove o card em seguida.
      setDetail(result ?? { id: cardId, checklists: [], notes: "", activities: [] });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, cardId]);

  // O detalhe carregado só vale para o card a que pertence. Derivar em vez de
  // limpar por efeito evita mostrar, por um instante, o checklist do card
  // anterior enquanto o novo ainda está sendo buscado.
  const currentDetail = detail && detail.id === cardId ? detail : null;

  function patchCard(patch: Parameters<typeof buildCardFormData>[1]) {
    if (!card) return;
    startTransition(async () => {
      const result = await saveCard(buildCardFormData(card, patch));
      if (!result.success) toast.error(result.error ?? "Não foi possível salvar");
    });
  }

  function handleToggleLabel(labelId: string) {
    if (!card) return;
    startTransition(async () => {
      const result = await toggleCardLabel(card.id, labelId);
      if (!result.success) toast.error(result.error ?? "Não foi possível salvar");
    });
  }

  if (!card) return null;

  const priority = PRIORITY_META[card.priority];
  const status = dueStatus(card.dueDate, card.completed);
  const column = columns.find((item) => item.id === card.columnId);

  const columnItems = Object.fromEntries(columns.map((item) => [item.id, item.name]));
  const priorityItems = Object.fromEntries(
    PRIORITY_ORDER.map((item) => [item, PRIORITY_META[item].label])
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="border-b pr-12">
          {card.color && (
            <span
              className="mb-2 block h-1.5 w-16 rounded-full"
              style={{ backgroundColor: card.color }}
              aria-hidden
            />
          )}
          <SheetTitle className="text-lg leading-snug break-words">{card.title}</SheetTitle>
          <SheetDescription>
            Em <span className="font-medium text-foreground">{column?.name ?? "—"}</span> · criado em{" "}
            {format(new Date(card.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · atualizado
            em {format(new Date(card.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </SheetDescription>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge variant="outline" className={cn("gap-1", priority.badgeClass)}>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: priority.color }}
                aria-hidden
              />
              {priority.label}
            </Badge>

            {card.dueDate && (
              <Badge variant="outline" className={cn("gap-1 border-transparent", DUE_STATUS_CLASS[status])}>
                <CalendarClock className="h-3 w-3" />
                {format(new Date(card.dueDate), "dd/MM/yyyy")}
                {status === "overdue" && " · atrasada"}
              </Badge>
            )}

            {card.completed && (
              <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Concluída
              </Badge>
            )}

            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Tabs defaultValue="detalhes">
            <TabsList className="w-full">
              <TabsTrigger value="detalhes" className="flex-1">
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="checklist" className="flex-1">
                Checklist
                {card.checklistTotal > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                    {card.checklistDone}/{card.checklistTotal}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="anotacoes" className="flex-1">
                Anotações
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex-1">
                Histórico
              </TabsTrigger>
            </TabsList>

            {/* ------------------------------ Detalhes ----------------------------- */}
            <TabsContent value="detalhes" className="mt-4 space-y-5">
              {card.description ? (
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <p className="rounded-lg border p-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {card.description}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Sem descrição. Use &quot;Editar card&quot; para adicionar uma.
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="detail-column">Coluna</Label>
                  <Select
                    id="detail-column"
                    items={columnItems}
                    value={card.columnId}
                    onValueChange={(value) => value && patchCard({ columnId: value as string })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="detail-priority">Prioridade</Label>
                  <Select
                    id="detail-priority"
                    items={priorityItems}
                    value={card.priority}
                    onValueChange={(value) => value && patchCard({ priority: value as TaskPriority })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_ORDER.map((item) => (
                        <SelectItem key={item} value={item}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: PRIORITY_META[item].color }}
                            />
                            {PRIORITY_META[item].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="detail-due">Data de vencimento</Label>
                <Input
                  id="detail-due"
                  type="date"
                  defaultValue={toDateInput(card.dueDate)}
                  onChange={(event) => patchCard({ dueDate: event.target.value })}
                />
              </div>

              {labels.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Etiquetas</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map((label) => {
                      const active = card.labelIds.includes(label.id);
                      return (
                        <button
                          key={label.id}
                          type="button"
                          disabled={pending}
                          onClick={() => handleToggleLabel(label.id)}
                          aria-pressed={active}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs font-medium transition-all disabled:opacity-60",
                            active
                              ? "text-white shadow-sm"
                              : "bg-muted text-muted-foreground hover:bg-muted/70"
                          )}
                          style={active ? { backgroundColor: label.color } : undefined}
                        >
                          {label.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Cor do card</Label>
                {/* A key remonta o seletor quando o card muda, para que a cor
                    mostrada seja a do card aberto e não a do anterior. */}
                <TaskColorPicker
                  key={`${card.id}-${card.color ?? "none"}`}
                  defaultValue={card.color ?? ""}
                  allowEmpty
                  onChange={(color) => patchCard({ color })}
                />
              </div>
            </TabsContent>

            {/* Checklist e anotações são remontados por `key` a cada card: os dois
                mantêm estado próprio e não devem herdar o do card anterior. */}
            <TabsContent value="checklist" className="mt-4">
              {currentDetail ? (
                <ChecklistSection
                  key={currentDetail.id}
                  cardId={card.id}
                  initialChecklists={currentDetail.checklists}
                />
              ) : (
                <SectionLoader />
              )}
            </TabsContent>

            <TabsContent value="anotacoes" className="mt-4">
              {currentDetail ? (
                <CardNotes key={currentDetail.id} cardId={card.id} initialContent={currentDetail.notes} />
              ) : (
                <SectionLoader />
              )}
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              {currentDetail ? <CardActivity activities={currentDetail.activities} /> : <SectionLoader />}
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter className="flex-row justify-between border-t">
          <Button variant="outline" className="gap-1.5" onClick={() => onEdit(card.id)}>
            <Pencil className="h-4 w-4" /> Editar card
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => onDuplicate(card.id)}>
              <Copy className="h-4 w-4" /> Duplicar
            </Button>
            <Button variant="destructive" className="gap-1.5" onClick={() => onDelete(card.id)}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function SectionLoader() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
    </div>
  );
}
