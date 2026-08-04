"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES } from "@/lib/ledger-calc";

/**
 * Navegação de mês do razão.
 *
 * O período vive na URL (?year=&month=), não em estado de cliente: a página
 * continua sendo Server Component, o cálculo acontece no servidor e o usuário
 * pode favoritar ou compartilhar um mês específico.
 */
export function LedgerPeriodPicker({
  year,
  month,
  currentYear,
  currentMonth,
}: {
  year: number;
  month: number;
  currentYear: number;
  currentMonth: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(nextYear: number, nextMonth: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(nextYear));
    params.set("month", String(nextMonth));
    router.push(`${pathname}?${params.toString()}`);
  }

  function shift(delta: number) {
    // Índice absoluto de meses evita um if para a virada de ano.
    const index = year * 12 + (month - 1) + delta;
    goTo(Math.floor(index / 12), (index % 12) + 1);
  }

  const isCurrent = year === currentYear && month === currentMonth;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-40 text-center text-sm font-medium">
        {MONTH_NAMES[month - 1]} de {year}
      </span>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isCurrent && (
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => goTo(currentYear, currentMonth)}>
          <RotateCcw className="h-3.5 w-3.5" /> Mês atual
        </Button>
      )}
    </div>
  );
}
