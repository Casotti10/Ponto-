"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaskColorPicker } from "@/components/tasks/task-color-picker";
import { deleteLabel, saveLabel } from "@/lib/actions/tasks";
import type { TaskLabelView } from "@/lib/task-service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  labels: TaskLabelView[];
}

/**
 * Gerenciador de etiquetas do quadro.
 *
 * Segue o padrão do `CategoriesManager` do financeiro: lista com edição em
 * linha e um formulário curto no mesmo diálogo.
 */
export function LabelManager({ open, onOpenChange, boardId, labels }: Props) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<TaskLabelView | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(label: TaskLabelView) {
    setEditing(label);
    setFormOpen(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveLabel(formData);
      if (result.success) {
        toast.success(editing ? "Etiqueta atualizada" : "Etiqueta criada");
        setFormOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar");
      }
    });
  }

  function handleDelete(label: TaskLabelView) {
    startTransition(async () => {
      const result = await deleteLabel(label.id);
      if (result.success) toast.success("Etiqueta excluída");
      else toast.error(result.error ?? "Não foi possível excluir");
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Etiquetas do quadro</DialogTitle>
            <DialogDescription>
              Excluir uma etiqueta não apaga cards — eles apenas deixam de tê-la.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {labels.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma etiqueta neste quadro ainda.</p>
            )}

            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <div
                  key={label.id}
                  className="flex items-center gap-2 rounded-lg border py-1 pr-1 pl-2.5 text-sm"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                  <span className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(label)}
                      aria-label={`Editar ${label.name}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={pending}
                      onClick={() => handleDelete(label)}
                      aria-label={`Excluir ${label.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={openNew}>
              <Plus className="h-4 w-4" /> Nova etiqueta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSubmit} key={editing?.id ?? "nova"}>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar etiqueta" : "Nova etiqueta"}</DialogTitle>
              <DialogDescription>
                O nome aparece direto no card, então funciona melhor curto.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <input type="hidden" name="boardId" value={boardId} />

              <div className="space-y-2">
                <Label htmlFor="label-name">Nome</Label>
                <Input
                  id="label-name"
                  name="name"
                  required
                  autoFocus
                  maxLength={40}
                  placeholder="Ex: Bug"
                  defaultValue={editing?.name ?? ""}
                />
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <TaskColorPicker name="color" defaultValue={editing?.color ?? "#2a78d6"} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
