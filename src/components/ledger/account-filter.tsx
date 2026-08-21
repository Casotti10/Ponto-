"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AccountBalance } from "@/lib/ledger-calc";

interface AccountFilterProps {
  accounts: AccountBalance[];
}

/**
 * Filtro de conta/banco para o dashboard financeiro.
 *
 * Permite selecionar "Todos os Bancos" ou uma conta específica.
 * Atualiza a URL sem recarregar a página.
 */
export function AccountFilter({ accounts }: AccountFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const accountId = searchParams.get("accountId");
  const activeAccounts = accounts.filter((a) => !a.archived);

  const selectedLabel = !accountId
    ? "Todos os bancos"
    : activeAccounts.find((a) => a.id === accountId)?.name ?? "Selecionar";

  const handleSelect = (newAccountId: string | null) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);

      if (newAccountId) {
        params.set("accountId", newAccountId);
      } else {
        params.delete("accountId");
      }

      const newUrl = `/financeiro?${params.toString()}`;
      router.push(newUrl);
    });
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 w-full sm:w-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isPending}
          >
            <span className="truncate text-left">{selectedLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        }
      />
      <PopoverContent className="w-50 p-0">
        <Command>
          <CommandInput placeholder="Buscar banco..." />
          <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              value="todos"
              onSelect={() => handleSelect(null)}
              className={cn("cursor-pointer", !accountId && "bg-accent")}
            >
              <Check
                className={cn("mr-2 h-4 w-4", !accountId ? "opacity-100" : "opacity-0")}
              />
              Todos os bancos
            </CommandItem>
          </CommandGroup>

          {activeAccounts.length > 0 && (
            <CommandGroup>
              {activeAccounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={account.id}
                  onSelect={() => handleSelect(account.id)}
                  className={cn("cursor-pointer", accountId === account.id && "bg-accent")}
                >
                  <div
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: account.color }}
                  />
                  <Check
                    className={cn("mr-2 h-4 w-4", accountId === account.id ? "opacity-100" : "opacity-0")}
                  />
                  {account.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
