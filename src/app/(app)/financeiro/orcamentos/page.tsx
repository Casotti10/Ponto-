import { Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBudgets, getFinancialGoals } from "@/lib/ledger-service";
import { MONTH_NAMES } from "@/lib/ledger-calc";
import { appNow } from "@/lib/timezone";
import { LedgerModuleNav } from "@/components/ledger/ledger-view-tabs";
import { LedgerPeriodPicker } from "@/components/ledger/ledger-period-picker";
import { BudgetManager } from "@/components/ledger/budget-manager";
import { GoalsManager } from "@/components/ledger/goals-manager";

/**
 * ORÇAMENTOS E METAS.
 *
 * O orçamento é mensal e por isso respeita o seletor de período; a meta é de
 * longo prazo e não depende do mês que está na tela. Ficam juntos porque
 * respondem à mesma pergunta em horizontes diferentes: "estou no caminho?".
 */
export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const now = appNow();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const year = Number(params.year) || currentYear;
  const month = Math.min(12, Math.max(1, Number(params.month) || currentMonth));

  const [budgets, goals] = await Promise.all([
    getBudgets(user.id, year, month),
    getFinancialGoals(user.id, now),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Target className="h-6 w-6" /> Orçamentos e metas
          </h1>
          <p className="text-muted-foreground">
            Limites de {MONTH_NAMES[month - 1].toLowerCase()} de {year} e objetivos de longo prazo.
          </p>
        </div>
        <LedgerPeriodPicker
          year={year}
          month={month}
          currentYear={currentYear}
          currentMonth={currentMonth}
        />
      </div>

      <LedgerModuleNav active="orcamentos" />

      <div className="grid gap-6 lg:grid-cols-2">
        <BudgetManager view={budgets} />
        <GoalsManager goals={goals} />
      </div>
    </div>
  );
}
