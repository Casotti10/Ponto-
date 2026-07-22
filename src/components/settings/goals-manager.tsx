"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createGoal, deleteGoal } from "@/lib/actions/settings";

export interface GoalItem {
  id: string;
  title: string;
  targetHours: number;
  year: number;
  month: number;
}

export function GoalsManager({ goals }: { goals: GoalItem[] }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const now = new Date();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createGoal(formData);
      if (result.success) {
        toast.success("Meta criada");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível criar a meta");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteGoal(id);
      if (result.success) toast.success("Meta removida");
      else toast.error(result.error ?? "Não foi possível remover");
    });
  }

  return (
    <div className="space-y-3">
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada</p>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => (
            <div key={goal.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{goal.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {goal.targetHours}h · {goal.month}/{goal.year}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(goal.id)} disabled={pending}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
          <Plus className="h-4 w-4" /> Nova meta
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Nova meta de horas</DialogTitle>
              <DialogDescription>Defina uma meta de horas trabalhadas para um mês específico.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input id="title" name="title" required placeholder="Ex: Meta de horas do mês" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="targetHours">Horas</Label>
                  <Input id="targetHours" name="targetHours" type="number" min="0" step="1" required defaultValue={160} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="month">Mês</Label>
                  <Input id="month" name="month" type="number" min="1" max="12" required defaultValue={now.getMonth() + 1} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Ano</Label>
                  <Input id="year" name="year" type="number" required defaultValue={now.getFullYear()} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Criar meta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
