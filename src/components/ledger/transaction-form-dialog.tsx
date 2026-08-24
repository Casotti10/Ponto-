"use client";

import { useMemo, useState, useTransition, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { saveTransaction } from "@/lib/actions/ledger";
import { centsToBRL, parseAmountToCents, MONTH_NAMES } from "@/lib/ledger-calc";
import { appDateString } from "@/lib/timezone";

export type LedgerStatus = "PENDENTE" | "LIQUIDADO" | "AGENDADO" | "CANCELADO";

export interface TransactionFormValues {
  id?: string;
  date: string;
  description: string;
  amount: string;
  type: "ENTRADA" | "SAIDA";
  accountId: string;
  categoryId?: string | null;
  notes?: string | null;
  status?: LedgerStatus;
  dueDate?: string | null;
}

/**
 * LIQUIDADO é um estado só, mas o usuário não pensa assim: numa saída ele diz
 * "paguei" e numa entrada "recebi". O enum não se divide — o rótulo sim.
 */
function statusLabels(type: "ENTRADA" | "SAIDA"): Record<LedgerStatus, string> {
  return {
    LIQUIDADO: type === "ENTRADA" ? "Recebido" : "Pago",
    PENDENTE: type === "ENTRADA" ? "A receber" : "A pagar",
    AGENDADO: "Agendado",
    CANCELADO: "Cancelado",
  };
}

interface Props {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: "ENTRADA" | "SAIDA" }[];
  /** Elemento que abre o diálogo. O conteúdo do gatilho vem em `children`. */
  trigger?: ReactElement;
  children?: ReactNode;
  initialValues?: TransactionFormValues;
  /**
   * Data que o formulário assume ao abrir para um lançamento novo, em
   * `yyyy-MM-dd`. A página manda o período que está na tela — sem isso o
   * formulário cairia sempre em "hoje", e um lançamento registrado com
   * setembro aberto seria salvo em agosto e sumiria da lista.
   */
  defaultDate?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TransactionFormDialog({
  accounts,
  categories,
  trigger,
  children,
  initialValues,
  defaultDate,
  open: openProp,
  onOpenChange,
}: Props) {
  const [openState, setOpenState] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = !!initialValues?.id;

  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  const fallbackDate = initialValues?.date ?? defaultDate ?? appDateString();

  // O tipo é controlado porque ele filtra as categorias: quem está lançando uma
  // despesa não deve ver "Salário" na lista.
  const [type, setType] = useState<"ENTRADA" | "SAIDA">(initialValues?.type ?? "SAIDA");
  const [amount, setAmount] = useState(initialValues?.amount ?? "");
  // A data é controlada para que o aviso de destino ("Aparece em Setembro de
  // 2026") acompanhe o campo enquanto o usuário digita.
  const [date, setDate] = useState(fallbackDate);
  // A situação é controlada porque decide o resto do formulário: só um
  // lançamento liquidado tem data de pagamento, e o rótulo muda com o tipo
  // ("Pago" numa saída, "Recebido" numa entrada).
  const [status, setStatus] = useState<LedgerStatus>(initialValues?.status ?? "LIQUIDADO");

  // Vencimento acompanha a competência enquanto o usuário não o define à mão —
  // é o caso da esmagadora maioria dos lançamentos.
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? fallbackDate);
  const [dueTouched, setDueTouched] = useState(false);

  // Reancoragem no padrão "ajustar estado durante a renderização" (e não num
  // efeito, que dispararia uma renderização em cascata): cada abertura do
  // diálogo, e cada mudança do período da tela, recoloca o campo na data certa.
  // Sem isso, quem abre em agosto, fecha, navega para setembro e abre de novo
  // continuaria vendo agosto no campo.
  const anchor = `${open}:${fallbackDate}`;
  const [lastAnchor, setLastAnchor] = useState(anchor);
  if (lastAnchor !== anchor) {
    setLastAnchor(anchor);
    setDate(fallbackDate);
    if (!dueTouched) setDueDate(initialValues?.dueDate ?? fallbackDate);
  }

  const labels = statusLabels(type);

  const availableCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  // O Select do Base UI precisa do mapa valor→rótulo para exibir o texto no
  // gatilho; sem `items` ele mostra o id cru.
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

  const parsedCents = parseAmountToCents(amount);

  // Em que mês este lançamento vai cair. É a informação que faltava: o destino
  // depende da DATA, não do mês que está aberto na tela.
  const targetPeriod = useMemo(() => {
    const [year, month] = date.split("-").map(Number);
    if (!year || !month || month < 1 || month > 12) return null;
    return `${MONTH_NAMES[month - 1]} de ${year}`;
  }, [date]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveTransaction(formData);
      if (result.success) {
        toast.success(isEdit ? "Lançamento atualizado" : "Lançamento registrado");
        setOpen(false);
        if (!isEdit) setAmount("");
      } else {
        toast.error(result.error ?? "Não foi possível salvar o lançamento");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger}>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ajuste os dados deste lançamento."
              : "Registre uma entrada ou uma saída de dinheiro."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {isEdit && <input type="hidden" name="id" value={initialValues!.id} />}
          <input type="hidden" name="type" value={type} />

          <div className="space-y-4 py-4">
            <Tabs
              value={type}
              onValueChange={(v) => v && setType(v as "ENTRADA" | "SAIDA")}
            >
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
                <Label htmlFor="amount">Valor</Label>
                <Input
                  id="amount"
                  name="amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  required
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p
                  className={cn(
                    "text-xs",
                    parsedCents === null && amount ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {amount
                    ? parsedCents !== null
                      ? centsToBRL(parsedCents)
                      : "Valor inválido"
                    : "Aceita 1.234,56 ou 1234.56"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Data do lançamento</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (!dueTouched) setDueDate(e.target.value);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {targetPeriod ? `Aparece em ${targetPeriod}` : "Data inválida"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Situação</Label>
                <select
                  id="status"
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LedgerStatus)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {(["LIQUIDADO", "PENDENTE", "AGENDADO", "CANCELADO"] as const).map((s) => (
                    <option key={s} value={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {status === "LIQUIDADO"
                    ? "Conta no saldo atual"
                    : status === "CANCELADO"
                      ? "Não impacta nenhum saldo"
                      : "Só no saldo projetado, não no atual"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Vencimento</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueTouched(true);
                    setDueDate(e.target.value);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {status === "LIQUIDADO"
                    ? "Opcional quando já foi liquidado"
                    : "Depois desta data o lançamento aparece como vencido"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                name="description"
                required
                maxLength={200}
                placeholder={type === "SAIDA" ? "Ex: mercado do mês" : "Ex: salário de agosto"}
                defaultValue={initialValues?.description ?? ""}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountId">Conta</Label>
                <Select
                  name="accountId"
                  items={accountItems}
                  defaultValue={initialValues?.accountId ?? accounts[0]?.id}
                  required
                >
                  <SelectTrigger id="accountId" className="w-full">
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
                <Label htmlFor="categoryId">Categoria</Label>
                {/* A key força o Select a remontar quando o tipo muda — sem isso
                    ele manteria selecionada uma categoria que sumiu da lista. */}
                <Select
                  key={type}
                  name="categoryId"
                  items={categoryItems}
                  defaultValue={
                    initialValues?.type === type ? (initialValues?.categoryId ?? "") : ""
                  }
                >
                  <SelectTrigger id="categoryId" className="w-full">
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

            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                maxLength={500}
                defaultValue={initialValues?.notes ?? ""}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : isEdit ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
