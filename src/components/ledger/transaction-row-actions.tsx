"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  TransactionFormDialog,
  type TransactionFormValues,
} from "@/components/ledger/transaction-form-dialog";
import { cancelTransaction, deleteTransaction, uncancelTransaction } from "@/lib/actions/ledger";

export function TransactionRowActions({
  transaction,
  accounts,
  categories,
  isRecurring,
}: {
  transaction: TransactionFormValues & { id: string };
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: "ENTRADA" | "SAIDA" }[];
  isRecurring: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const cancelada = transaction.status === "CANCELADO";

  function handleCancel() {
    startTransition(async () => {
      const result = cancelada
        ? await uncancelTransaction(transaction.id)
        : await cancelTransaction(transaction.id);
      if (result.success) {
        toast.success(cancelada ? "Lançamento reativado" : "Lançamento cancelado");
      } else {
        toast.error(result.error ?? "Não foi possível concluir");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTransaction(transaction.id);
      if (result.success) {
        toast.success("Lançamento excluído");
        setDeleteOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível excluir");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCancel} disabled={pending}>
            {cancelada ? (
              <>
                <RotateCcw className="mr-2 h-4 w-4" /> Reativar
              </>
            ) : (
              <>
                <Ban className="mr-2 h-4 w-4" /> Cancelar
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TransactionFormDialog
        accounts={accounts}
        categories={categories}
        initialValues={transaction}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {isRecurring
                ? "Este lançamento veio de uma recorrência. Ao excluir, ele será recriado na próxima vez que você abrir este mês — para parar de vez, desative a recorrência."
                : "Esta ação não pode ser desfeita. Se a intenção é só tirar o lançamento das contas, prefira Cancelar — ele para de impactar qualquer saldo mas continua no histórico."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={pending}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
