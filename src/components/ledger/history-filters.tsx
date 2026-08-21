"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AccountBalance } from "@/lib/ledger-calc";
import type { LedgerCategory } from "@/lib/ledger-service";

const ALL = "__all__";

/**
 * Filtros da visão geral.
 *
 * Todos vivem na URL, pelo mesmo motivo do seletor de período da visão mensal:
 * é o Server Component que consulta o banco, então mudar um filtro precisa
 * mudar a requisição — não a renderização de um conjunto já carregado.
 *
 * Qualquer mudança de filtro volta para a página 1: continuar na página 7 de um
 * recorte que agora tem duas páginas mostraria uma lista vazia sem explicação.
 */
export function HistoryFilters({
  accounts,
  categories,
  availableYears,
}: {
  accounts: AccountBalance[];
  categories: LedgerCategory[];
  availableYears: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const year = searchParams.get("year") ?? ALL;
  const type = searchParams.get("type") ?? ALL;
  const accountId = searchParams.get("accountId") ?? ALL;
  const categoryId = searchParams.get("categoryId") ?? ALL;

  const activeAccounts = accounts.filter((a) => !a.archived);

  function apply(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    apply("q", search.trim() || null);
  }

  function clearAll() {
    setSearch("");
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["year", "type", "accountId", "categoryId", "q", "page"]) {
      params.delete(key);
    }
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  const hasFilters =
    year !== ALL || type !== ALL || accountId !== ALL || categoryId !== ALL || !!searchParams.get("q");

  const yearItems = useMemo(
    () => ({ [ALL]: "Todos os anos", ...Object.fromEntries(availableYears.map((y) => [String(y), String(y)])) }),
    [availableYears]
  );
  const typeItems = useMemo(
    () => ({ [ALL]: "Entradas e saídas", ENTRADA: "Só entradas", SAIDA: "Só saídas" }),
    []
  );
  const accountItems = useMemo(
    () => ({ [ALL]: "Todos os bancos", ...Object.fromEntries(activeAccounts.map((a) => [a.id, a.name])) }),
    [activeAccounts]
  );
  const categoryItems = useMemo(
    () => ({
      [ALL]: "Todas as categorias",
      __none__: "Sem categoria",
      ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
    }),
    [categories]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-year" className="text-xs text-muted-foreground">
            Ano
          </Label>
          <Select items={yearItems} value={year} onValueChange={(v) => apply("year", v as string)}>
            <SelectTrigger id="filter-year" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os anos</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-type" className="text-xs text-muted-foreground">
            Tipo
          </Label>
          <Select items={typeItems} value={type} onValueChange={(v) => apply("type", v as string)}>
            <SelectTrigger id="filter-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Entradas e saídas</SelectItem>
              <SelectItem value="ENTRADA">Só entradas</SelectItem>
              <SelectItem value="SAIDA">Só saídas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-account" className="text-xs text-muted-foreground">
            Banco
          </Label>
          <Select
            items={accountItems}
            value={accountId}
            onValueChange={(v) => apply("accountId", v as string)}
          >
            <SelectTrigger id="filter-account" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os bancos</SelectItem>
              {activeAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-category" className="text-xs text-muted-foreground">
            Categoria
          </Label>
          <Select
            items={categoryItems}
            value={categoryId}
            onValueChange={(v) => apply("categoryId", v as string)}
          >
            <SelectTrigger id="filter-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as categorias</SelectItem>
              <SelectItem value="__none__">Sem categoria</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <form onSubmit={submitSearch} className="flex flex-1 items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="filter-search" className="text-xs text-muted-foreground">
              Buscar na descrição
            </Label>
            <Input
              id="filter-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex: mercado, aluguel, salário..."
            />
          </div>
          <Button type="submit" variant="outline" className="gap-1.5">
            <Search className="h-4 w-4" /> Buscar
          </Button>
        </form>

        {hasFilters && (
          <Button type="button" variant="ghost" onClick={clearAll} className="gap-1.5">
            <X className="h-4 w-4" /> Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
