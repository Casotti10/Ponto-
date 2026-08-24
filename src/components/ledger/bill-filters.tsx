"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { BillFilter } from "@/lib/ledger-service";

const OPTIONS: { key: BillFilter; label: string }[] = [
  { key: "pendentes", label: "Em aberto" },
  { key: "vencidas", label: "Vencidas" },
  { key: "hoje", label: "Vence hoje" },
  { key: "proximos7", label: "Próximos 7 dias" },
  { key: "proximos30", label: "Próximos 30 dias" },
  { key: "liquidadas", label: "Liquidadas" },
  { key: "todas", label: "Todas" },
];

/**
 * Filtro da lista de contas.
 *
 * Escreve na URL em vez de guardar estado local: cada opção é uma consulta nova
 * ao banco no Server Component, e não um recorte do que já veio. É a mesma
 * convenção do seletor de período — e o que garante que "vencidas" signifique
 * vencidas no banco, não vencidas entre as que a página carregou.
 */
export function BillFilters({ active }: { active: BillFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(filter: BillFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("filtro", filter);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <nav aria-label="Filtrar contas" className="flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((option) => {
        const isActive = option.key === active;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => go(option.key)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}
