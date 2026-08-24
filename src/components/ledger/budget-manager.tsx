"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Target, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { deleteBudget, saveBudget } from "@/lib/actions/ledger";
import { centsToBRL } from "@/lib/ledger-calc";
import type { BudgetLine, BudgetsView } from "@/lib/ledger-service";

/**
 * Orçamento do mês: teto por categoria e o teto geral.
 *
 * A barra para em 100% mesmo quando estourou — passar de 100 faria a barra
 * mentir sobre a escala. O estouro é dito pelo texto e pela cor, que é
 * codificação secundária: quem não distingue vermelho continua lendo
 * "R$ 120,00 acima".
 */
export function BudgetManager({ view }: { view: BudgetsView }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      const result = await saveBudget(formData);
      if (result.success) {
        toast.success("Orçamento salvo");
        form.reset();
        setAdding(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteBudget(id);
      if (result.success) toast.success("Orçamento removido");
      else toast.error(result.error ?? "Não foi possível remover");
    });
  }

  const semOrcamento = view.lines.length === 0 && !view.total;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" /> Orçamento do mês
          </CardTitle>
          <CardDescription>Quanto você planeja gastar em cada categoria.</CardDescription>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Definir
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {adding && (
          <form onSubmit={submit} className="space-y-3 rounded-md border bg-muted/30 p-3">
            <input type="hidden" name="year" value={view.year} />
            <input type="hidden" name="month" value={view.month} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="budget-category">Categoria</Label>
                <select
                  id="budget-category"
                  name="categoryId"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Orçamento total do mês</option>
                  {view.categoriesWithoutBudget.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget-limit">Limite</Label>
                <Input
                  id="budget-limit"
                  name="limit"
                  inputMode="decimal"
                  required
                  placeholder="0,00"
                />
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

        {semOrcamento && !adding && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Nenhum orçamento definido para este mês. Definir um limite é o que permite saber que
            você está gastando demais <em>antes</em> do fim do mês.
          </p>
        )}

        {view.total && <BudgetBar line={view.total} onRemove={remove} pending={pending} emphasized />}

        {view.lines.map((line) => (
          <BudgetBar key={line.id} line={line} onRemove={remove} pending={pending} />
        ))}
      </CardContent>
    </Card>
  );
}

function BudgetBar({
  line,
  onRemove,
  pending,
  emphasized,
}: {
  line: BudgetLine;
  onRemove: (id: string) => void;
  pending: boolean;
  emphasized?: boolean;
}) {
  const excedente = line.spentCents - line.limitCents;

  return (
    <div className={cn("space-y-1.5", emphasized && "rounded-md border bg-muted/30 p-3")}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: line.categoryColor }}
            aria-hidden
          />
          <span className="truncate">{line.categoryName}</span>
          {line.exceeded && (
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-500" aria-hidden />
          )}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {centsToBRL(line.spentCents)} <span aria-hidden>/</span>{" "}
          <span className="text-foreground">{centsToBRL(line.limitCents)}</span>
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            line.exceeded ? "bg-red-600 dark:bg-red-500" : "bg-emerald-600 dark:bg-emerald-500"
          )}
          style={{ width: `${line.percent}%` }}
          role="progressbar"
          aria-valuenow={line.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${line.categoryName}: ${line.percent}% do orçamento`}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            line.exceeded ? "font-medium text-red-600 dark:text-red-500" : "text-muted-foreground"
          )}
        >
          {line.exceeded
            ? `${centsToBRL(excedente)} acima do limite`
            : `${centsToBRL(line.remainingCents)} disponível`}
        </span>
        {line.id && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => onRemove(line.id!)}
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
          >
            <Trash2 className="h-3 w-3" /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}
