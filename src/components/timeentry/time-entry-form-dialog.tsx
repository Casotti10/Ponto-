"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createTimeEntry, updateTimeEntry, createTimeEntriesForDay } from "@/lib/actions/time-entries";
import { appDateString, appTimeString } from "@/lib/timezone";

const TYPE_LABELS: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA_ALMOCO: "Saída para almoço",
  RETORNO_ALMOCO: "Retorno do almoço",
  SAIDA: "Saída",
};

const DAY_ENTRY_TYPES = ["ENTRADA", "SAIDA_ALMOCO", "RETORNO_ALMOCO", "SAIDA"] as const;

const DAY_ENTRY_DEFAULTS: Record<(typeof DAY_ENTRY_TYPES)[number], string> = {
  ENTRADA: "08:00",
  SAIDA_ALMOCO: "12:00",
  RETORNO_ALMOCO: "13:00",
  SAIDA: "18:00",
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
  const [mode, setMode] = useState<"single" | "day">("single");
  const isEdit = !!initialValues?.id;

  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  function handleSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
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

  function handleDaySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createTimeEntriesForDay(formData);
      if (result.success) {
        toast.success("Registros do dia criados com sucesso");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar os registros");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar registro" : "Novo registro de ponto"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ajuste a data, horário e tipo do registro."
              : mode === "single"
                ? "Preencha a data, horário e tipo do registro."
                : "Preencha os horários do dia todo de uma vez. Deixe em branco o que não se aplica."}
          </DialogDescription>
        </DialogHeader>

        {!isEdit && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "day")}>
            <TabsList className="w-full">
              <TabsTrigger value="single" className="flex-1">
                Registro único
              </TabsTrigger>
              <TabsTrigger value="day" className="flex-1">
                Dia completo
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {(isEdit || mode === "single") && (
          <form onSubmit={handleSingleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={initialValues?.date ?? appDateString()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Horário</Label>
                <Input
                  id="time"
                  name="time"
                  type="time"
                  required
                  defaultValue={initialValues?.time ?? appTimeString()}
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
        )}

        {!isEdit && mode === "day" && (
          <form onSubmit={handleDaySubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="day-date">Data</Label>
                <Input id="day-date" name="date" type="date" required defaultValue={appDateString()} />
              </div>
              {DAY_ENTRY_TYPES.map((type) => (
                <div key={type} className="space-y-2">
                  <Label htmlFor={`day-${type}`}>{TYPE_LABELS[type]}</Label>
                  <Input id={`day-${type}`} name={type} type="time" defaultValue={DAY_ENTRY_DEFAULTS[type]} />
                </div>
              ))}
              <div className="col-span-2 space-y-2">
                <Label htmlFor="day-notes">Observações (opcional)</Label>
                <Textarea
                  id="day-notes"
                  name="notes"
                  placeholder="Aplicada a todos os registros criados"
                  defaultValue=""
                />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Limpe o campo de horário para não criar aquele registro.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar dia completo"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
