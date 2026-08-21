"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Paginação da visão geral.
 *
 * A página é um parâmetro de URL porque quem pagina é o banco (`skip`/`take`):
 * o cliente nunca tem a lista inteira em mãos para fatiar.
 */
export function HistoryPagination({
  page,
  pageCount,
  totalCount,
  pageSize,
}: {
  page: number;
  pageCount: number;
  totalCount: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  const first = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        {totalCount === 0
          ? "Nenhum lançamento"
          : `Mostrando ${first}–${last} de ${totalCount} lançamento(s)`}
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            Página {page} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={page >= pageCount}
            onClick={() => goToPage(page + 1)}
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
