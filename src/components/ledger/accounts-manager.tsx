"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColorPicker } from "@/components/ledger/color-picker";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_LABELS, centsToBRL } from "@/lib/ledger-calc";
import { deleteAccount, saveAccount, toggleAccountArchived } from "@/lib/actions/ledger";

export interface AccountItem {
  id: string;
  name: string;
  type: string;
  color: string;
  archived: boolean;
  openingBalanceCents: number;
  balanceCents: number;
  transactionCount: number;
}

export function AccountsManager({ accounts }: { accounts: AccountItem[] }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<AccountItem | null>(null);
  const [open, setOpen] = useState(false);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(account: AccountItem) {
    setEditing(account);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveAccount(formData);
      if (result.success) {
        toast.success(editing ? "Conta atualizada" : "Conta criada");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar");
      }
    });
  }

  function handleDelete(account: AccountItem) {
    startTransition(async () => {
      const result = await deleteAccount(account.id);
      if (result.success) toast.success("Conta excluída");
      else toast.error(result.error ?? "Não foi possível excluir");
    });
  }

  function handleToggleArchive(account: AccountItem) {
    startTransition(async () => {
      const result = await toggleAccountArchived(account.id);
      if (result.success) toast.success(account.archived ? "Conta reativada" : "Conta arquivada");
      else toast.error(result.error ?? "Não foi possível alterar");
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {accounts.map((account) => (
          <div
            key={account.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border p-3",
              account.archived && "opacity-60"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-8 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: account.color }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {account.name}
                  {account.archived && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">arquivada</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ACCOUNT_TYPE_LABELS[account.type] ?? account.type} · {account.transactionCount} lançamento(s)
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <span
                className={cn(
                  "mr-2 text-sm font-semibold tabular-nums",
                  account.balanceCents < 0 && "text-red-600 dark:text-red-400"
                )}
              >
                {centsToBRL(account.balanceCents)}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(account)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={pending}
                onClick={() => handleToggleArchive(account)}
                aria-label={account.archived ? "Reativar conta" : "Arquivar conta"}
              >
                {account.archived ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={pending}
                onClick={() => handleDelete(account)}
                aria-label="Excluir conta"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={openNew}>
        <Plus className="h-4 w-4" /> Nova conta
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          {/* A key remonta o formulário ao trocar de conta editada, para que os
              defaultValue dos campos não-controlados sejam reinicializados. */}
          <form onSubmit={handleSubmit} key={editing?.id ?? "new"}>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle>
              <DialogDescription>
                Contas separam onde o dinheiro está: banco, carteira, cartão.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {editing && <input type="hidden" name="id" value={editing.id} />}

              <div className="space-y-2">
                <Label htmlFor="account-name">Nome</Label>
                <Input
                  id="account-name"
                  name="name"
                  required
                  maxLength={60}
                  placeholder="Ex: Nubank"
                  defaultValue={editing?.name ?? ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-type">Tipo</Label>
                <Select
                  name="type"
                  items={ACCOUNT_TYPE_LABELS}
                  defaultValue={editing?.type ?? "CORRENTE"}
                  required
                >
                  <SelectTrigger id="account-type" className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-opening">Saldo inicial</Label>
                <Input
                  id="account-opening"
                  name="openingBalance"
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue={
                    editing && editing.openingBalanceCents !== 0
                      ? (editing.openingBalanceCents / 100).toFixed(2).replace(".", ",")
                      : ""
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Quanto já havia nesta conta antes de você começar a lançar aqui.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <ColorPicker name="color" defaultValue={editing?.color ?? "#2a78d6"} />
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
