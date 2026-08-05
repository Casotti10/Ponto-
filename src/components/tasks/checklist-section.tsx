"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ListChecks, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import {
  addChecklist,
  addChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  updateChecklistItem,
} from "@/lib/actions/tasks";
import { checklistProgress } from "@/lib/task-calc";
import type { ChecklistView } from "@/lib/task-service";

interface Props {
  cardId: string;
  /** Estado inicial. O componente é remontado por `key` quando o card muda. */
  initialChecklists: ChecklistView[];
}

/**
 * Checklists do card.
 *
 * O componente é dono do próprio estado: cada operação aplica a mudança na tela
 * primeiro e confirma com o servidor depois. Esperar o ida e volta para a caixa
 * mudar de cor faria a lista parecer travada, e recarregar tudo a cada item
 * fecharia o campo de digitação no meio da lista que a pessoa está escrevendo.
 *
 * As actions de criação devolvem o registro gravado, então o id local é sempre
 * o real — nunca há um id provisório para reconciliar. Se a gravação falhar, o
 * estado anterior é restaurado.
 */
export function ChecklistSection({ cardId, initialChecklists }: Props) {
  const [lists, setLists] = useState(initialChecklists);
  const [pending, startTransition] = useTransition();
  const [newItemFor, setNewItemFor] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [editingItem, setEditingItem] = useState<{ id: string; content: string } | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");

  const allItems = lists.flatMap((list) => list.items);
  const progress = checklistProgress(allItems.filter((item) => item.done).length, allItems.length);

  function run(action: () => Promise<{ success: boolean; error?: string }>, rollback: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        rollback();
        toast.error(result.error ?? "Não foi possível salvar");
      }
    });
  }

  function handleToggle(checklistId: string, itemId: string, done: boolean) {
    const previous = lists;
    setLists((current) =>
      current.map((list) =>
        list.id === checklistId
          ? {
              ...list,
              items: list.items.map((item) => (item.id === itemId ? { ...item, done } : item)),
            }
          : list
      )
    );
    run(() => updateChecklistItem(itemId, { done }), () => setLists(previous));
  }

  function handleAddItem(checklistId: string) {
    const content = newItemText.trim();
    if (!content) return;
    setNewItemText("");

    startTransition(async () => {
      const result = await addChecklistItem(checklistId, content);
      if (result.success && result.data) {
        const item = result.data;
        setLists((current) =>
          current.map((list) =>
            list.id === checklistId ? { ...list, items: [...list.items, item] } : list
          )
        );
      } else {
        // O texto volta para o campo: perder o que foi digitado por causa de
        // uma falha de rede seria pior que o erro em si.
        setNewItemText(content);
        toast.error(result.error ?? "Não foi possível adicionar o item");
      }
    });
  }

  function handleSaveEdit() {
    if (!editingItem) return;
    const content = editingItem.content.trim();
    const itemId = editingItem.id;
    setEditingItem(null);
    if (!content) return;

    const previous = lists;
    setLists((current) =>
      current.map((list) => ({
        ...list,
        items: list.items.map((item) => (item.id === itemId ? { ...item, content } : item)),
      }))
    );
    run(() => updateChecklistItem(itemId, { content }), () => setLists(previous));
  }

  function handleDeleteItem(itemId: string) {
    const previous = lists;
    setLists((current) =>
      current.map((list) => ({
        ...list,
        items: list.items.filter((item) => item.id !== itemId),
      }))
    );
    run(() => deleteChecklistItem(itemId), () => setLists(previous));
  }

  function handleDeleteList(listId: string) {
    const previous = lists;
    setLists((current) => current.filter((list) => list.id !== listId));
    run(() => deleteChecklist(listId), () => setLists(previous));
  }

  function handleAddList() {
    const title = newListTitle.trim() || "Checklist";
    setNewListTitle("");
    setCreatingList(false);

    startTransition(async () => {
      const result = await addChecklist(cardId, title);
      if (result.success && result.data) {
        const checklist = result.data;
        setLists((current) => [...current, checklist]);
      } else {
        toast.error(result.error ?? "Não foi possível criar o checklist");
      }
    });
  }

  return (
    <div className="space-y-4">
      {allItems.length > 0 && (
        <div className="rounded-lg border p-3">
          <Progress value={progress.percent}>
            <ProgressLabel>Progresso</ProgressLabel>
            <ProgressValue />
          </Progress>
          <p className="mt-2 text-xs text-muted-foreground">{progress.label}</p>
        </div>
      )}

      {lists.length === 0 && (
        <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          Nenhum checklist ainda. Crie um para quebrar a tarefa em passos.
        </p>
      )}

      {lists.map((list) => {
        const listProgress = checklistProgress(
          list.items.filter((item) => item.done).length,
          list.items.length
        );

        return (
          <div key={list.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
              <h4 className="min-w-0 flex-1 truncate text-sm font-medium">{list.title}</h4>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {listProgress.done}/{listProgress.total}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={pending}
                aria-label={`Excluir checklist ${list.title}`}
                onClick={() => handleDeleteList(list.id)}
              >
                <Trash2 />
              </Button>
            </div>

            <ul className="space-y-0.5">
              {list.items.map((item) => (
                <li
                  key={item.id}
                  className="group/item flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={item.done}
                    disabled={pending}
                    onCheckedChange={(checked) => handleToggle(list.id, item.id, checked === true)}
                    aria-label={item.content}
                  />

                  {editingItem?.id === item.id ? (
                    <span className="flex min-w-0 flex-1 items-center gap-1">
                      <Input
                        value={editingItem.content}
                        autoFocus
                        maxLength={300}
                        onChange={(event) =>
                          setEditingItem({ id: item.id, content: event.target.value })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleSaveEdit();
                          }
                          if (event.key === "Escape") setEditingItem(null);
                        }}
                        className="h-7"
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={handleSaveEdit}
                        aria-label="Salvar item"
                      >
                        <Check />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditingItem(null)}
                        aria-label="Cancelar edição"
                      >
                        <X />
                      </Button>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingItem({ id: item.id, content: item.content })}
                        className={cn(
                          "min-w-0 flex-1 truncate text-left text-sm transition-colors hover:text-primary",
                          item.done && "text-muted-foreground line-through"
                        )}
                      >
                        {item.content}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={pending}
                        aria-label={`Excluir ${item.content}`}
                        onClick={() => handleDeleteItem(item.id)}
                        className="opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {newItemFor === list.id ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={newItemText}
                  autoFocus
                  maxLength={300}
                  placeholder="Descreva o item"
                  onChange={(event) => setNewItemText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddItem(list.id);
                    }
                    if (event.key === "Escape") {
                      setNewItemFor(null);
                      setNewItemText("");
                    }
                  }}
                  className="h-8"
                />
                <Button size="sm" disabled={pending} onClick={() => handleAddItem(list.id)}>
                  Adicionar
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Fechar"
                  onClick={() => {
                    setNewItemFor(null);
                    setNewItemText("");
                  }}
                >
                  <X />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => {
                  setNewItemFor(list.id);
                  setNewItemText("");
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar item
              </Button>
            )}
          </div>
        );
      })}

      {creatingList ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={newListTitle}
            autoFocus
            maxLength={100}
            placeholder="Nome do checklist"
            onChange={(event) => setNewListTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddList();
              }
              if (event.key === "Escape") setCreatingList(false);
            }}
            className="h-8"
          />
          <Button size="sm" disabled={pending} onClick={handleAddList}>
            Criar
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cancelar"
            onClick={() => setCreatingList(false)}
          >
            <X />
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCreatingList(true)}>
          <Plus className="h-4 w-4" /> Novo checklist
        </Button>
      )}
    </div>
  );
}
