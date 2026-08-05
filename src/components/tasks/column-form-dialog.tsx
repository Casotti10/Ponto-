"use client";

import { useTransition } from "react";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import { TaskColorPicker } from "@/components/tasks/task-color-picker";
import { saveColumn } from "@/lib/actions/tasks";

export interface ColumnFormValues {
  id?: string;
  name: string;
  color: string;
  isDone: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  initialValues: ColumnFormValues;
}

export function ColumnFormDialog({ open, onOpenChange, boardId, initialValues }: Props) {
  const [pending, startTransition] = useTransition();
  const isEdit = !!initialValues.id;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveColumn(formData);
      if (result.success) {
        toast.success(isEdit ? "Coluna atualizada" : "Coluna criada");
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar a coluna");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} key={initialValues.id ?? "nova"}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar coluna" : "Nova coluna"}</DialogTitle>
            <DialogDescription>
              Colunas são as etapas do fluxo — os cards caminham da esquerda para a direita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isEdit && <input type="hidden" name="id" value={initialValues.id} />}
            <input type="hidden" name="boardId" value={boardId} />

            <div className="space-y-2">
              <Label htmlFor="column-name">Nome</Label>
              <Input
                id="column-name"
                name="name"
                required
                autoFocus
                maxLength={60}
                placeholder="Ex: Em Revisão"
                defaultValue={initialValues.name}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <TaskColorPicker name="color" defaultValue={initialValues.color} />
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border p-3">
              <Checkbox
                id="column-done"
                name="isDone"
                defaultChecked={initialValues.isDone}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="column-done" className="cursor-pointer">
                  Coluna de conclusão
                </Label>
                <p className="text-xs text-muted-foreground">
                  Card que chega aqui é marcado como concluído — e volta a ficar aberto se sair.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
