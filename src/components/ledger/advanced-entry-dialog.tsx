"use client";

import { useState, useTransition, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, CreditCard, Loader2 } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { createInstallmentPurchase, createTransfer } from "@/lib/actions/ledger";
import {
  centsToBRL,
  installmentDueDates,
  ledgerDayFromISO,
  parseAmountToCents,
  splitInstallments,
} from "@/lib/ledger-calc";
import { appDateString } from "@/lib/timezone";

interface Props {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: "ENTRADA" | "SAIDA" }[];
  defaultDate?: string;
  trigger?: ReactElement;
  children?: ReactNode;
}

/**
 * Os dois lançamentos que não cabem no formulário simples.
 *
 * Compra parcelada gera N lançamentos; transferência gera um par. Nenhum dos
 * dois é "um lançamento com campos a mais", então forçá-los no mesmo formulário
 * transformaria a tela mais usada do módulo na mais confusa.
 */
export function AdvancedEntryDialog({
  accounts,
  categories,
  defaultDate,
  trigger,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"parcelado" | "transferencia">("parcelado");
  const [pending, startTransition] = useTransition();

  const hoje = defaultDate ?? appDateString();

  // Parcelamento
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("12");
  const [firstDue, setFirstDue] = useState(hoje);

  // Transferência
  const [transferAmount, setTransferAmount] = useState("");

  const totalCents = parseAmountToCents(amount);
  const parcelas = Number(count);
  const previa =
    totalCents !== null && parcelas >= 2 && parcelas <= 72
      ? splitInstallments(totalCents, parcelas)
      : null;
  const vencimentos =
    previa && firstDue ? installmentDueDates(ledgerDayFromISO(firstDue), parcelas) : null;

  const despesaCategorias = categories.filter((c) => c.type === "SAIDA");

  function reset() {
    setAmount("");
    setCount("12");
    setFirstDue(hoje);
    setTransferAmount("");
  }

  function submit(e: React.FormEvent<HTMLFormElement>, action: (fd: FormData) => Promise<{ success: boolean; error?: string }>, ok: string) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result.success) {
        toast.success(ok);
        setOpen(false);
        reset();
      } else {
        toast.error(result.error ?? "Não foi possível salvar");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {trigger && <DialogTrigger render={trigger}>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "parcelado" ? "Compra parcelada" : "Transferência entre contas"}
          </DialogTitle>
          <DialogDescription>
            {mode === "parcelado"
              ? "Gera um lançamento por parcela, cada um no seu mês e com o próprio vencimento."
              : "Move dinheiro entre suas contas sem contar como receita nem como despesa."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => v && setMode(v as typeof mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="parcelado" className="flex-1 gap-1.5">
              <CreditCard className="h-4 w-4" /> Parcelada
            </TabsTrigger>
            <TabsTrigger value="transferencia" className="flex-1 gap-1.5">
              <ArrowLeftRight className="h-4 w-4" /> Transferência
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "parcelado" ? (
          <form onSubmit={(e) => submit(e, createInstallmentPurchase, "Parcelas registradas")}>
            <input type="hidden" name="type" value="SAIDA" />
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inst-description">O que foi comprado</Label>
                <Input id="inst-description" name="description" required maxLength={180} placeholder="Ex: notebook" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="inst-amount">Valor total</Label>
                  <Input
                    id="inst-amount"
                    name="amount"
                    inputMode="decimal"
                    required
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inst-count">Parcelas</Label>
                  <Input
                    id="inst-count"
                    name="count"
                    type="number"
                    min={2}
                    max={72}
                    required
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inst-due">1º vencimento</Label>
                  <Input
                    id="inst-due"
                    name="firstDueDate"
                    type="date"
                    required
                    value={firstDue}
                    onChange={(e) => setFirstDue(e.target.value)}
                  />
                </div>
              </div>

              {/* A prévia é calculada com as MESMAS funções que a action usa no
                  servidor, então o que aparece aqui é o que será gravado. */}
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  previa ? "text-muted-foreground" : "text-muted-foreground/60"
                )}
              >
                {previa && vencimentos ? (
                  <>
                    <p className="font-medium text-foreground">
                      {parcelas}× de {centsToBRL(previa[0])}
                      {previa[0] !== previa[previa.length - 1] &&
                        ` (a última de ${centsToBRL(previa[previa.length - 1])})`}
                    </p>
                    <p className="mt-0.5">
                      De {vencimentos[0].toISOString().slice(0, 10).split("-").reverse().join("/")} a{" "}
                      {vencimentos[vencimentos.length - 1]
                        .toISOString()
                        .slice(0, 10)
                        .split("-")
                        .reverse()
                        .join("/")}
                      {" · "}
                      soma {centsToBRL(previa.reduce((a, b) => a + b, 0))}
                    </p>
                  </>
                ) : (
                  "Informe valor e número de parcelas para ver a prévia."
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="inst-account">Conta</Label>
                  <select
                    id="inst-account"
                    name="accountId"
                    required
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inst-category">Categoria</Label>
                  <select
                    id="inst-category"
                    name="categoryId"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="">Sem categoria</option>
                    {despesaCategorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                As parcelas nascem <strong>a pagar</strong>: dívida futura não reduz o saldo de
                hoje. Cada uma pode ser baixada em Contas a pagar.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !previa}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? "Gerando..." : `Gerar ${parcelas || ""} parcelas`}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={(e) => submit(e, createTransfer, "Transferência registrada")}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tr-from">De</Label>
                  <select
                    id="tr-from"
                    name="fromAccountId"
                    required
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tr-to">Para</Label>
                  <select
                    id="tr-to"
                    name="toAccountId"
                    required
                    defaultValue={accounts[1]?.id}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tr-amount">Valor</Label>
                  <Input
                    id="tr-amount"
                    name="amount"
                    inputMode="decimal"
                    required
                    placeholder="0,00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {parseAmountToCents(transferAmount) !== null && transferAmount
                      ? centsToBRL(parseAmountToCents(transferAmount)!)
                      : "Aceita 1.234,56"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tr-date">Data</Label>
                  <Input id="tr-date" name="date" type="date" required defaultValue={hoje} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tr-description">Descrição (opcional)</Label>
                <Input
                  id="tr-description"
                  name="description"
                  maxLength={180}
                  placeholder="Deixe em branco para usar os nomes das contas"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Gera dois lançamentos ligados: saída na origem e entrada no destino. Nenhum dos
                dois conta como receita ou despesa — só o saldo das contas se move.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || accounts.length < 2}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pending ? "Transferindo..." : "Transferir"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
