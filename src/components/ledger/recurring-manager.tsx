"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { centsToBRL, FREQUENCY_LABELS, MONTH_NAMES } from "@/lib/ledger-calc";
import {
  deleteRecurringTransaction,
  saveRecurringTransaction,
  toggleRecurringActive,
} from "@/lib/actions/ledger";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export interface RecurringItem {
  id: string;
  description: string;
  amountCents: number;
  type: "ENTRADA" | "SAIDA";
  frequency: string;
  dayOfMonth: number;
  weekday: number;
  monthOfYear: number;
  active: boolean;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  startDate: Date;
  endDate: Date | null;
}

function describeSchedule(item: RecurringItem) {
  switch (item.frequency) {
    case "SEMANAL":
      return `Toda ${WEEKDAYS[item.weekday]?.toLowerCase()}`;
    case "ANUAL":
      return `Todo dia ${item.dayOfMonth} de ${MONTH_NAMES[item.monthOfYear - 1]}`;
    default:
      return `Todo dia ${item.dayOfMonth}`;
  }
}

export function RecurringManager({
  recurrences,
  accounts,
  categories,
}: {
  recurrences: RecurringItem[];
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: "ENTRADA" | "SAIDA" }[];
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<RecurringItem | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"ENTRADA" | "SAIDA">("SAIDA");
  const [frequency, setFrequency] = useState<"MENSAL" | "SEMANAL" | "ANUAL">("MENSAL");

  const availableCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  // Mapas valor→rótulo exigidos pelo Select do Base UI (sem eles o gatilho
  // exibe o valor cru em vez do texto).
  const accountItems = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a.name])),
    [accounts]
  );
  const categoryItems = useMemo(
    () => ({
      "": "Sem categoria",
      ...Object.fromEntries(availableCategories.map((c) => [c.id, c.name])),
    }),
    [availableCategories]
  );
  const weekdayItems = Object.fromEntries(WEEKDAYS.map((label, index) => [String(index), label]));
  const monthItems = Object.fromEntries(MONTH_NAMES.map((label, index) => [String(index + 1), label]));

  function openNew() {
    setEditing(null);
    setType("SAIDA");
    setFrequency("MENSAL");
    setOpen(true);
  }

  function openEdit(item: RecurringItem) {
    setEditing(item);
    setType(item.type);
    setFrequency(item.frequency as "MENSAL" | "SEMANAL" | "ANUAL");
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveRecurringTransaction(formData);
      if (result.success) {
        toast.success(editing ? "Recorrência atualizada" : "Recorrência criada");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar");
      }
    });
  }

  function handleToggle(item: RecurringItem) {
    startTransition(async () => {
      const result = await toggleRecurringActive(item.id);
      if (result.success) toast.success(item.active ? "Recorrência pausada" : "Recorrência ativada");
      else toast.error(result.error ?? "Não foi possível alterar");
    });
  }

  function handleDelete(item: RecurringItem) {
    startTransition(async () => {
      const result = await deleteRecurringTransaction(item.id);
      if (result.success) toast.success("Recorrência excluída");
      else toast.error(result.error ?? "Não foi possível excluir");
    });
  }

  return (
    <div className="space-y-3">
      {recurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum lançamento recorrente. Cadastre o aluguel, o salário ou uma assinatura e ele passa a
          aparecer sozinho todo mês.
        </p>
      ) : (
        <div className="space-y-2">
          {recurrences.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border p-3",
                !item.active && "opacity-60"
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Repeat className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {FREQUENCY_LABELS[item.frequency]} · {describeSchedule(item)} · {item.accountName}
                    {item.categoryName ? ` · ${item.categoryName}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <span
                  className={cn(
                    "mr-2 text-sm font-semibold tabular-nums",
                    item.type === "ENTRADA"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {item.type === "ENTRADA" ? "+" : "−"}
                  {centsToBRL(item.amountCents)}
                </span>
                <Switch
                  checked={item.active}
                  onCheckedChange={() => handleToggle(item)}
                  disabled={pending}
                  aria-label={item.active ? "Pausar recorrência" : "Ativar recorrência"}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={pending}
                  onClick={() => handleDelete(item)}
                  aria-label="Excluir recorrência"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" className="gap-1.5" onClick={openNew}>
        <Plus className="h-4 w-4" /> Novo lançamento recorrente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit} key={editing?.id ?? "new"}>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar recorrência" : "Novo lançamento recorrente"}</DialogTitle>
              <DialogDescription>
                O lançamento é criado sozinho a cada mês que você abrir, sem duplicar o que já existe.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="frequency" value={frequency} />

              <Tabs value={type} onValueChange={(v) => v && setType(v as "ENTRADA" | "SAIDA")}>
                <TabsList className="w-full">
                  <TabsTrigger value="SAIDA" className="flex-1">
                    Saída
                  </TabsTrigger>
                  <TabsTrigger value="ENTRADA" className="flex-1">
                    Entrada
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rec-amount">Valor</Label>
                  <Input
                    id="rec-amount"
                    name="amount"
                    inputMode="decimal"
                    placeholder="0,00"
                    required
                    defaultValue={
                      editing ? (editing.amountCents / 100).toFixed(2).replace(".", ",") : ""
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rec-frequency">Frequência</Label>
                  <Tabs
                    value={frequency}
                    onValueChange={(v) => v && setFrequency(v as "MENSAL" | "SEMANAL" | "ANUAL")}
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="MENSAL" className="flex-1 text-xs">
                        Mês
                      </TabsTrigger>
                      <TabsTrigger value="SEMANAL" className="flex-1 text-xs">
                        Semana
                      </TabsTrigger>
                      <TabsTrigger value="ANUAL" className="flex-1 text-xs">
                        Ano
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rec-description">Descrição</Label>
                <Input
                  id="rec-description"
                  name="description"
                  required
                  maxLength={200}
                  placeholder="Ex: Aluguel"
                  defaultValue={editing?.description ?? ""}
                />
              </div>

              {/* Só o campo que a frequência escolhida usa fica visível; os demais
                  viajam como hidden para o schema continuar recebendo tudo. */}
              {frequency === "SEMANAL" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="rec-weekday">Dia da semana</Label>
                    <Select name="weekday" items={weekdayItems} defaultValue={String(editing?.weekday ?? 1)}>
                      <SelectTrigger id="rec-weekday" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((label, index) => (
                          <SelectItem key={label} value={String(index)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <input type="hidden" name="dayOfMonth" value={editing?.dayOfMonth ?? 1} />
                  <input type="hidden" name="monthOfYear" value={editing?.monthOfYear ?? 1} />
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rec-day">Dia do mês</Label>
                    <Input
                      id="rec-day"
                      name="dayOfMonth"
                      type="number"
                      min="1"
                      max="31"
                      required
                      defaultValue={editing?.dayOfMonth ?? 5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Dia 31 cai no último dia em meses mais curtos.
                    </p>
                  </div>
                  {frequency === "ANUAL" ? (
                    <div className="space-y-2">
                      <Label htmlFor="rec-month">Mês</Label>
                      <Select name="monthOfYear" items={monthItems} defaultValue={String(editing?.monthOfYear ?? 1)}>
                        <SelectTrigger id="rec-month" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_NAMES.map((label, index) => (
                            <SelectItem key={label} value={String(index + 1)}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <input type="hidden" name="monthOfYear" value={editing?.monthOfYear ?? 1} />
                  )}
                  <input type="hidden" name="weekday" value={editing?.weekday ?? 1} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rec-account">Conta</Label>
                  <Select
                    name="accountId"
                    items={accountItems}
                    defaultValue={editing?.accountId ?? accounts[0]?.id}
                    required
                  >
                    <SelectTrigger id="rec-account" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rec-category">Categoria</Label>
                  <Select
                    key={type}
                    name="categoryId"
                    items={categoryItems}
                    defaultValue={editing?.type === type ? (editing?.categoryId ?? "") : ""}
                  >
                    <SelectTrigger id="rec-category" className="w-full">
                      <SelectValue placeholder="Sem categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem categoria</SelectItem>
                      {availableCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rec-start">Começa em</Label>
                  <Input
                    id="rec-start"
                    name="startDate"
                    type="date"
                    required
                    defaultValue={format(editing?.startDate ?? new Date(), "yyyy-MM-dd")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rec-end">Termina em (opcional)</Label>
                  <Input
                    id="rec-end"
                    name="endDate"
                    type="date"
                    defaultValue={editing?.endDate ? format(editing.endDate, "yyyy-MM-dd") : ""}
                  />
                </div>
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
    </div>
  );
}
