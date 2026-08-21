"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES } from "@/lib/ledger-calc";

/**
 * Navegação de período do razão.
 *
 * O período vive na URL (?year=&month=), não em estado de cliente: a página
 * continua sendo Server Component, a consulta ao banco acontece no servidor a
 * cada troca e o usuário pode favoritar ou compartilhar um mês específico.
 *
 * Mês e ano são DOIS controles porque são duas dimensões do filtro: agosto/2025
 * e agosto/2026 são períodos distintos, e navegar de um para o outro pelas
 * setas custaria doze cliques.
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

  // Janela de anos ao redor do atual, garantindo que o ano selecionado esteja
  // na lista mesmo quando for muito antigo ou futuro.
  const years = useMemo(() => {
    const range = new Set<number>();
    for (let y = currentYear - 5; y <= currentYear + 2; y++) range.add(y);
    range.add(year);
    return Array.from(range).sort((a, b) => b - a);
  }, [currentYear, year]);

  const monthItems = useMemo(
    () => Object.fromEntries(MONTH_NAMES.map((name, index) => [String(index + 1), name])),
    []
  );
  const yearItems = useMemo(
    () => Object.fromEntries(years.map((y) => [String(y), String(y)])),
    [years]
  );

  const isCurrent = year === currentYear && month === currentMonth;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => shift(-1)}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Select
        items={monthItems}
        value={String(month)}
        onValueChange={(value) => goTo(year, Number(value))}
      >
        <SelectTrigger aria-label="Mês" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((name, index) => (
            <SelectItem key={name} value={String(index + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={yearItems}
        value={String(year)}
        onValueChange={(value) => goTo(Number(value), month)}
      >
        <SelectTrigger aria-label="Ano" className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => shift(1)}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => goTo(currentYear, currentMonth)}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Mês atual
        </Button>
      )}
    </div>
  );
}
