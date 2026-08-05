"use client";

import { ArrowDownUp, Filter, Search, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  SORT_LABELS,
  hasActiveFilters,
  type CardFilters,
  type SortMode,
} from "@/lib/task-calc";
import type { TaskLabelView } from "@/lib/task-service";
import type { TaskPriority } from "@prisma/client";

interface Props {
  filters: CardFilters;
  onFiltersChange: (filters: CardFilters) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  labels: TaskLabelView[];
  /** Quantos cards sobraram depois do filtro, para dar retorno imediato. */
  visibleCount: number;
  totalCount: number;
}

/**
 * Busca, filtros e ordenação.
 *
 * Tudo acontece na memória do cliente, sobre os cards que a página já carregou:
 * filtrar não é uma pergunta nova ao banco, e por isso não recarrega a página
 * nem pisca a tela — que é o comportamento esperado de um quadro.
 */
export function BoardToolbar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  labels,
  visibleCount,
  totalCount,
}: Props) {
  const active = hasActiveFilters(filters);

  function togglePriority(priority: TaskPriority) {
    onFiltersChange({
      ...filters,
      priorities: filters.priorities.includes(priority)
        ? filters.priorities.filter((item) => item !== priority)
        : [...filters.priorities, priority],
    });
  }

  function toggleLabel(labelId: string) {
    onFiltersChange({
      ...filters,
      labelIds: filters.labelIds.includes(labelId)
        ? filters.labelIds.filter((id) => id !== labelId)
        : [...filters.labelIds, labelId],
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          placeholder="Buscar por título ou descrição"
          aria-label="Buscar cards"
          className="pl-8"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Limpar busca"
            onClick={() => onFiltersChange({ ...filters, search: "" })}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X />
          </Button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" className="gap-1.5" />}>
          <Filter className="h-4 w-4" />
          Prioridade
          {filters.priorities.length > 0 && (
            <Badge variant="secondary" className="ml-0.5">
              {filters.priorities.length}
            </Badge>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Filtrar por prioridade</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PRIORITY_ORDER.map((priority) => {
            const meta = PRIORITY_META[priority];
            return (
              <DropdownMenuCheckboxItem
                key={priority}
                checked={filters.priorities.includes(priority)}
                onCheckedChange={() => togglePriority(priority)}
              >
                <span
                  className="mr-1 h-2 w-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                {meta.label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {labels.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" className="gap-1.5" />}>
            <Tag className="h-4 w-4" />
            Etiquetas
            {filters.labelIds.length > 0 && (
              <Badge variant="secondary" className="ml-0.5">
                {filters.labelIds.length}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filtrar por etiqueta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {labels.map((label) => (
              <DropdownMenuCheckboxItem
                key={label.id}
                checked={filters.labelIds.includes(label.id)}
                onCheckedChange={() => toggleLabel(label.id)}
              >
                <span
                  className="mr-1 h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: label.color }}
                  aria-hidden
                />
                {label.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" className="gap-1.5" />}>
          <ArrowDownUp className="h-4 w-4" />
          <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ordenar cards por</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
            <DropdownMenuItem
              key={mode}
              onClick={() => onSortChange(mode)}
              className={cn(sort === mode && "font-medium text-foreground")}
            >
              {SORT_LABELS[mode]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {active && (
        <>
          <span className="text-xs text-muted-foreground tabular-nums">
            {visibleCount} de {totalCount} card(s)
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => onFiltersChange({ search: "", priorities: [], labelIds: [] })}
          >
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </Button>
        </>
      )}

      {/* Fora da ordem manual a posição na tela não é a posição gravada, então o
          arrasto fica desligado — e o caminho de volta precisa estar à mão. */}
      {sort !== "manual" && (
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => onSortChange("manual")}>
          <ArrowDownUp className="h-3.5 w-3.5" /> Arrastar exige a ordem manual
        </Button>
      )}
    </div>
  );
}
