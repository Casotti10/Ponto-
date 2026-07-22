"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAbsence, updateAbsence } from "@/lib/actions/absences";
import { format } from "date-fns";

export const ABSENCE_TYPE_LABELS: Record<string, string> = {
  FALTA_JUSTIFICADA: "Falta justificada",
  FALTA_INJUSTIFICADA: "Falta injustificada",
  BANCO_HORAS: "Banco de horas (compensação)",
  FOLGA: "Folga",
  FERIAS: "Férias",
  LICENCA: "Licença",
  COMPENSACAO: "Compensação",
  HOME_OFFICE: "Home office",
};

const NEEDS_HOURS = new Set(["BANCO_HORAS", "COMPENSACAO"]);
const NEEDS_END_DATE = new Set(["FERIAS", "LICENCA"]);

export interface AbsenceFormValues {
  id?: string;
  date: string;
  endDate?: string | null;
  type: string;
  hours?: number | null;
  reason?: string | null;
}

interface Props {
  trigger?: ReactElement;
  initialValues?: AbsenceFormValues;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AbsenceFormDialog({ trigger, initialValues, open: openProp, onOpenChange }: Props) {
  const [openState, setOpenState] = useState(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState(initialValues?.type ?? "FALTA_JUSTIFICADA");
  const isEdit = !!initialValues?.id;

  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEdit ? await updateAbsence(initialValues!.id!, formData) : await createAbsence(formData);
      if (result.success) {
        toast.success(isEdit ? "Ausência atualizada" : "Ausência registrada");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setType(initialValues?.type ?? "FALTA_JUSTIFICADA");
      }}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar ausência" : "Nova ausência"}</DialogTitle>
            <DialogDescription>
              Cada tipo de ausência impacta o saldo do banco de horas de forma diferente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                name="type"
                items={ABSENCE_TYPE_LABELS}
                value={type}
                onValueChange={(v) => setType(v ?? "FALTA_JUSTIFICADA")}
                required
              >
                <SelectTrigger id="type" className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ABSENCE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">{NEEDS_END_DATE.has(type) ? "Data inicial" : "Data"}</Label>
              <Input id="date" name="date" type="date" required defaultValue={initialValues?.date ?? format(new Date(), "yyyy-MM-dd")} />
            </div>

            {NEEDS_END_DATE.has(type) ? (
              <div className="space-y-2">
                <Label htmlFor="endDate">Data final</Label>
                <Input id="endDate" name="endDate" type="date" defaultValue={initialValues?.endDate ?? ""} />
              </div>
            ) : (
              <input type="hidden" name="endDate" value="" />
            )}

            {NEEDS_HOURS.has(type) && (
              <div className="col-span-2 space-y-2">
                <Label htmlFor="hours">Horas utilizadas do banco</Label>
                <Input
                  id="hours"
                  name="hours"
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  placeholder="8"
                  defaultValue={initialValues?.hours ?? undefined}
                />
              </div>
            )}

            <div className="col-span-2 space-y-2">
              <Label htmlFor="reason">Motivo / observações</Label>
              <Textarea id="reason" name="reason" placeholder="Descreva o motivo" defaultValue={initialValues?.reason ?? ""} />
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
