"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTimeEntry, updateTimeEntry } from "@/lib/actions/time-entries";
import { format } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA_ALMOCO: "Saída para almoço",
  RETORNO_ALMOCO: "Retorno do almoço",
  SAIDA: "Saída",
};

export interface TimeEntryFormValues {
  id?: string;
  date: string;
  time: string;
  type: string;
  notes?: string | null;
}

interface Props {
  trigger?: ReactElement;
  initialValues?: TimeEntryFormValues;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TimeEntryFormDialog({ trigger, initialValues, open: openProp, onOpenChange }: Props) {
  const [openState, setOpenState] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = !!initialValues?.id;

  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEdit
        ? await updateTimeEntry(initialValues!.id!, formData)
        : await createTimeEntry(formData);

      if (result.success) {
        toast.success(isEdit ? "Registro atualizado" : "Registro criado com sucesso");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar o registro");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar registro" : "Novo registro de ponto"}</DialogTitle>
            <DialogDescription>
              Preencha a data, horário e tipo do registro. Você pode adicionar observações opcionais.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={initialValues?.date ?? format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                name="time"
                type="time"
                required
                defaultValue={initialValues?.time ?? format(new Date(), "HH:mm")}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="type">Tipo de registro</Label>
              <Select name="type" items={TYPE_LABELS} defaultValue={initialValues?.type ?? "ENTRADA"} required>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea id="notes" name="notes" placeholder="Ex: atraso justificado por trânsito" defaultValue={initialValues?.notes ?? ""} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
