import Link from "next/link";
import { CalendarRange, List } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Alterna entre as duas visões do razão.
 *
 * São ROTAS diferentes, não abas de cliente: cada uma é um Server Component com
 * a sua própria consulta ao banco (`getMonthlyLedger` vs. `getLedgerHistory`).
 * A visão mensal carrega um mês; a geral carrega o histórico paginado. Nenhuma
 * das duas chega a ver os dados da outra, que é justamente o ponto — foi a
 * mistura das duas perguntas na mesma tela que fazia mês vazar para mês.
 *
 * O período viaja junto na URL para que voltar da visão geral devolva o usuário
 * ao mês em que ele estava.
 */
export function LedgerViewTabs({
  active,
  monthlyHref = "/financeiro",
  overviewHref = "/financeiro/geral",
}: {
  active: "mensal" | "geral";
  monthlyHref?: string;
  overviewHref?: string;
}) {
  const tabs = [
    { key: "mensal" as const, href: monthlyHref, label: "Visão mensal", icon: CalendarRange },
    { key: "geral" as const, href: overviewHref, label: "Visão geral", icon: List },
  ];

  return (
    <nav
      aria-label="Visualização do financeiro"
      className="inline-flex w-fit items-center gap-1 rounded-lg border bg-muted/40 p-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
