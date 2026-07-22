"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createBalanceAdjustment } from "@/lib/actions/balance";
import { format } from "date-fns";

export function AdjustmentFormDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"add" | "remove">("add");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const hours = Number(formData.get("hoursInput"));
    const minutes = Math.round(hours * 60) * (mode === "remove" ? -1 : 1);
    formData.set("minutes", String(minutes));

    startTransition(async () => {
      const result = await createBalanceAdjustment(formData);
      if (result.success) {
        toast.success("Ajuste registrado no banco de horas");
        setOpen(false);
        (document.getElementById("adjustment-form") as HTMLFormElement)?.reset();
      } else {
        toast.error(result.error ?? "Não foi possível registrar o ajuste");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Plus className="h-4 w-4" /> Ajustar saldo
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form id="adjustment-form" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajuste manual do banco de horas</DialogTitle>
            <DialogDescription>
              Use esta opção para corrigir o saldo manualmente. O motivo é obrigatório e fica registrado no
              histórico de alterações.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "add" | "remove")}>
              <TabsList className="w-full">
                <TabsTrigger value="add" className="flex-1 gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Adicionar horas
                </TabsTrigger>
                <TabsTrigger value="remove" className="flex-1 gap-1.5">
                  <Minus className="h-3.5 w-3.5" /> Remover horas
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="hoursInput">Quantidade de horas</Label>
              <Input id="hoursInput" name="hoursInput" type="number" step="0.25" min="0.25" required placeholder="Ex: 2.5" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data do ajuste</Label>
              <Input id="date" name="date" type="date" defaultValue={format(new Date(), "yyyy-MM-dd")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo do ajuste</Label>
              <Textarea id="reason" name="reason" required placeholder="Ex: Correção de saldo migrado do sistema anterior" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Confirmar ajuste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
