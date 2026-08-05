"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskColorPicker } from "@/components/tasks/task-color-picker";
import { saveCard } from "@/lib/actions/tasks";
import { PRIORITY_META, PRIORITY_ORDER } from "@/lib/task-calc";
import type { TaskLabelView } from "@/lib/task-service";
import type { TaskPriority } from "@prisma/client";

export interface CardFormValues {
  id?: string;
  columnId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  color: string;
  labelIds: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: { id: string; name: string }[];
  labels: TaskLabelView[];
  initialValues: CardFormValues;
}

/**
 * Formulário de card.
 *
 * `initialValues` vale só na montagem: quem renderiza passa uma `key` derivada
 * do card, o que remonta o diálogo a cada abertura. É o que impede a seleção de
 * etiquetas de um card vazar para o próximo, sem um efeito de sincronização.
 */
export function CardFormDialog({ open, onOpenChange, columns, labels, initialValues }: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedLabels, setSelectedLabels] = useState<string[]>(initialValues.labelIds);
  const isEdit = !!initialValues.id;

  const columnItems = Object.fromEntries(columns.map((column) => [column.id, column.name]));
  const priorityItems = Object.fromEntries(
    PRIORITY_ORDER.map((priority) => [priority, PRIORITY_META[priority].label])
  );

  function toggleLabel(labelId: string) {
    setSelectedLabels((current) =>
      current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId]
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveCard(formData);
      if (result.success) {
        toast.success(isEdit ? "Card atualizado" : "Card criado");
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar o card");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* A key remonta o formulário a cada card, para que os defaultValue
            dos campos não controlados sejam relidos. */}
        <form onSubmit={handleSubmit} key={initialValues.id ?? `new-${initialValues.columnId}`}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar card" : "Novo card"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Ajuste os dados desta tarefa."
                : "Descreva a tarefa. Checklist e anotações ficam disponíveis ao abrir o card."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isEdit && <input type="hidden" name="id" value={initialValues.id} />}
            <input type="hidden" name="labelIds" value={selectedLabels.join(",")} />

            <div className="space-y-2">
              <Label htmlFor="card-title">Título</Label>
              <Input
                id="card-title"
                name="title"
                required
                autoFocus
                maxLength={200}
                placeholder="Ex: Revisar relatório de agosto"
                defaultValue={initialValues.title}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-description">Descrição curta</Label>
              <Textarea
                id="card-description"
                name="description"
                rows={2}
                maxLength={500}
                placeholder="Um resumo que caiba no card"
                defaultValue={initialValues.description}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="card-column">Coluna</Label>
                <Select
                  name="columnId"
                  items={columnItems}
                  defaultValue={initialValues.columnId}
                  required
                >
                  <SelectTrigger id="card-column" className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-priority">Prioridade</Label>
                <Select
                  name="priority"
                  items={priorityItems}
                  defaultValue={initialValues.priority}
                  required
                >
                  <SelectTrigger id="card-priority" className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_ORDER.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: PRIORITY_META[priority].color }}
                          />
                          {PRIORITY_META[priority].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-due">Vencimento</Label>
                <Input
                  id="card-due"
                  name="dueDate"
                  type="date"
                  defaultValue={initialValues.dueDate}
                />
              </div>
            </div>

            {labels.length > 0 && (
              <div className="space-y-2">
                <Label>Etiquetas</Label>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => {
                    const active = selectedLabels.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => toggleLabel(label.id)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-md px-2 py-1 text-xs font-medium transition-all",
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

            <div className="space-y-2">
              <Label>Cor do card</Label>
              <TaskColorPicker name="color" defaultValue={initialValues.color} allowEmpty />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : isEdit ? "Salvar" : "Criar card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
