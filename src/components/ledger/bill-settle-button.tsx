"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { settleTransaction, unsettleTransaction } from "@/lib/actions/ledger";
import { appDateString } from "@/lib/timezone";

/**
 * Baixa feita direto na linha da lista.
 *
 * O caminho comum — "paguei essa hoje" — precisa ser um clique. Quem pagou em
 * outra data abre o menu e informa; forçar todo mundo a preencher a data para
 * atender a minoria transformaria a tarefa mais frequente da tela na mais lenta.
 */
export function BillSettleButton({
  id,
  type,
  settled,
}: {
  id: string;
  type: "ENTRADA" | "SAIDA";
  settled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const [date, setDate] = useState(appDateString());

  const verb = type === "ENTRADA" ? "Recebido" : "Pago";

  function run(action: Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const result = await action;
      if (result.success) {
        toast.success(ok);
        setCustomOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível concluir");
      }
    });
  }

  if (settled) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(unsettleTransaction(id), "Baixa desfeita")}
        className="gap-1.5 text-xs text-muted-foreground"
        title="Desfazer a baixa"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
        Desfazer
      </Button>
    );
  }

  if (customOpen) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Data da baixa"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
        />
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => run(settleTransaction(id, date), `Marcado como ${verb.toLowerCase()}`)}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setCustomOpen(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(settleTransaction(id), `Marcado como ${verb.toLowerCase()}`)}
        className="gap-1.5 text-xs"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        {verb}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setCustomOpen(true)}
        className="text-xs text-muted-foreground"
        title="Informar outra data"
      >
        outra data
      </Button>
    </div>
  );
}
