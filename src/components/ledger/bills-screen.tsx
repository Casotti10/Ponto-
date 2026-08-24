import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarX, Wallet2, Sigma } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BillFilters } from "@/components/ledger/bill-filters";
import { BillSettleButton } from "@/components/ledger/bill-settle-button";
import { LedgerModuleNav } from "@/components/ledger/ledger-view-tabs";
import { centsToBRL, formatLedgerDate, isOverdue } from "@/lib/ledger-calc";
import { ledgerColors } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import type { BillsView } from "@/lib/ledger-service";

/**
 * Contas a pagar e a receber — a mesma tela, dois sentidos.
 *
 * São rotas diferentes porque são perguntas diferentes ("o que devo" vs. "o que
 * me devem") e cada uma tem o seu próprio cache, mas o layout é o mesmo: os
 * indicadores em cima respondem quanto e quão urgente, a lista embaixo responde
 * o quê.
 */
export function BillsScreen({
  view,
  todayLedger,
}: {
  view: BillsView;
  /** Hoje no dia contábil, para decidir o que está vencido. */
  todayLedger: Date;
}) {
  const isPayable = view.type === "SAIDA";
  const titulo = isPayable ? "Contas a pagar" : "Contas a receber";
  const rotuloTotal = isPayable ? "Total a pagar" : "Total a receber";
  const { indicators } = view;

  const vazio = view.transactions.length === 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {isPayable ? <CalendarX className="h-6 w-6" /> : <Wallet2 className="h-6 w-6" />}
          {titulo}
        </h1>
        <p className="text-muted-foreground">
          {isPayable
            ? "O que ainda precisa ser pago, por vencimento."
            : "O que ainda está por receber, por vencimento."}
        </p>
      </div>

      <LedgerModuleNav active={isPayable ? "a-pagar" : "a-receber"} />

      {/* Os indicadores somam o pipeline INTEIRO em aberto, mesmo com a lista
          filtrada: filtrar por "vence hoje" não pode encolher o total a pagar,
          senão o número que orienta a decisão muda conforme o que se olha. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={rotuloTotal}
          value={centsToBRL(indicators.pendingCents)}
          icon={Sigma}
          tone={indicators.pendingCents > 0 ? (isPayable ? "warn" : "good") : "neutral"}
          iconColor={isPayable ? ledgerColors.light.expense : ledgerColors.light.income}
          hint={`${indicators.pendingCount} lançamento(s) em aberto`}
        />
        <StatCard
          label="Vencido"
          value={centsToBRL(indicators.overdueCents)}
          icon={AlertTriangle}
          tone={indicators.overdueCents > 0 ? "bad" : "good"}
          iconColor={ledgerColors.light.expense}
          hint={
            indicators.overdueCount > 0
              ? `${indicators.overdueCount} passou do vencimento`
              : "Nada em atraso"
          }
        />
        <StatCard
          label="Vence hoje"
          value={centsToBRL(indicators.dueTodayCents)}
          icon={CalendarClock}
          tone={indicators.dueTodayCents > 0 ? "warn" : "neutral"}
          iconColor={ledgerColors.light.balance}
          hint={`${indicators.dueTodayCount} lançamento(s)`}
        />
        <StatCard
          label="Próximos 7 dias"
          value={centsToBRL(indicators.next7Cents)}
          icon={CalendarClock}
          tone="neutral"
          iconColor={ledgerColors.light.projection}
          hint={`${indicators.next7Count} lançamento(s), hoje incluído`}
        />
      </div>

      <BillFilters active={view.filter} />

      {vazio ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium">Nada aqui neste filtro</p>
            <p className="max-w-md text-xs text-muted-foreground">
              {view.filter === "pendentes"
                ? isPayable
                  ? "Você não tem contas em aberto. Um lançamento vira conta a pagar quando é registrado com a situação “A pagar”."
                  : "Você não tem valores a receber. Um lançamento vira conta a receber quando é registrado com a situação “A receber”."
                : "Experimente outro filtro acima."}
            </p>
            <Button variant="outline" size="sm" className="mt-1" render={<Link href="/financeiro" />}>
              Ir para a visão mensal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y rounded-lg border">
          {view.transactions.map((tx) => {
            const vencida = isOverdue(tx, todayLedger);
            const liquidada = tx.status === "LIQUIDADO";
            const vencimento = tx.dueDate ?? tx.date;

            return (
              <div
                key={tx.id}
                className={cn(
                  "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                  liquidada && "opacity-60"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{tx.description}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Vence {formatLedgerDate(vencimento)}</span>
                    <span aria-hidden>·</span>
                    <span>{tx.accountName}</span>
                    {tx.categoryName && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{tx.categoryName}</span>
                      </>
                    )}
                    {vencida && (
                      <Badge variant="outline" className="border-red-600/40 px-1 py-0 text-[10px] text-red-600 dark:text-red-500">
                        Vencida
                      </Badge>
                    )}
                    {liquidada && (
                      <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                        {isPayable ? "Pago" : "Recebido"}
                        {tx.settledDate && ` em ${formatLedgerDate(tx.settledDate)}`}
                      </Badge>
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isPayable
                        ? "text-red-600 dark:text-red-500"
                        : "text-emerald-600 dark:text-emerald-500"
                    )}
                  >
                    {centsToBRL(tx.amountCents)}
                  </span>
                  <BillSettleButton id={tx.id} type={view.type} settled={liquidada} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
