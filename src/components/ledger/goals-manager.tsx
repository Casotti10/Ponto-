"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, CheckCircle2, Flag, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { archiveFinancialGoal, saveFinancialGoal } from "@/lib/actions/ledger";
import { centsToBRL, formatLedgerDate } from "@/lib/ledger-calc";
import { categoryPalette } from "@/lib/chart-colors";
import type { GoalLine } from "@/lib/ledger-service";

/**
 * Metas financeiras — juntar dinheiro para um objetivo.
 *
 * O valor guardado é editado à mão, e não somado de uma conta: vincular a meta
 * a um saldo faria ela subir e descer a cada gasto do mês, que não é como
 * alguém acompanha "estou juntando para o carro".
 */
export function GoalsManager({ goals }: { goals: GoalLine[] }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      const result = await saveFinancialGoal(formData);
      if (result.success) {
        toast.success("Meta salva");
        form.reset();
        setAdding(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar");
      }
    });
  }

  function archive(id: string) {
    startTransition(async () => {
      const result = await archiveFinancialGoal(id);
      if (result.success) toast.success("Meta arquivada");
      else toast.error(result.error ?? "Não foi possível arquivar");
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="h-4 w-4" /> Metas financeiras
          </CardTitle>
          <CardDescription>Objetivos de médio e longo prazo.</CardDescription>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Nova meta
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {adding && (
          <form onSubmit={submit} className="space-y-3 rounded-md border bg-muted/30 p-3">
            <input type="hidden" name="color" value={categoryPalette.light[goals.length % 6]} />
            <div className="space-y-1.5">
              <Label htmlFor="goal-name">Objetivo</Label>
              <Input id="goal-name" name="name" required maxLength={80} placeholder="Ex: comprar carro" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-target">Quanto preciso</Label>
                <Input id="goal-target" name="target" inputMode="decimal" required placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-current">Já tenho</Label>
                <Input id="goal-current" name="current" inputMode="decimal" placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-deadline">Prazo (opcional)</Label>
                <Input id="goal-deadline" name="deadline" type="date" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </form>
        )}

        {goals.length === 0 && !adding && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Nenhuma meta ativa.
          </p>
        )}

        {goals.map((goal) => (
          <div key={goal.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: goal.color }}
                  aria-hidden
                />
                <span className="truncate">{goal.name}</span>
                {goal.reached && (
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500"
                    aria-hidden
                  />
                )}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {centsToBRL(goal.currentCents)} <span aria-hidden>/</span>{" "}
                <span className="text-foreground">{centsToBRL(goal.targetCents)}</span>
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${goal.percent}%`, backgroundColor: goal.color }}
                role="progressbar"
                aria-valuenow={goal.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${goal.name}: ${goal.percent}% da meta`}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {goal.percent}%
                {goal.deadline && (
                  <>
                    {" · "}
                    <span
                      className={cn(
                        goal.daysLeft !== null &&
                          goal.daysLeft < 0 &&
                          !goal.reached &&
                          "text-red-600 dark:text-red-500"
                      )}
                    >
                      {goal.daysLeft !== null && goal.daysLeft < 0
                        ? `prazo venceu em ${formatLedgerDate(goal.deadline)}`
                        : `faltam ${goal.daysLeft} dia(s)`}
                    </span>
                  </>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => archive(goal.id)}
                className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
                title="Arquivar (não apaga o histórico)"
              >
                <Archive className="h-3 w-3" /> Arquivar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
