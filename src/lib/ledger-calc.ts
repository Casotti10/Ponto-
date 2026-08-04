/**
 * Camada PURA do razão financeiro (entradas e saídas).
 *
 * Espelha o papel de `src/lib/time-calc.ts` no controle de ponto: nenhuma
 * função aqui toca no banco de dados. Ela recebe lançamentos já carregados e
 * devolve totais, saldos e séries prontas para os gráficos — o que torna todas
 * as regras testáveis sem subir Postgres.
 *
 * REGRA DE OURO DO DINHEIRO: todo valor trafega em CENTAVOS (inteiro). Somar
 * `0.1 + 0.2` em ponto flutuante devolve `0.30000000000000004`, e num razão
 * financeiro esse erro se acumula lançamento a lançamento até o saldo não
 * fechar. A conversão para reais acontece só na formatação, na borda da UI.
 */

export type TransactionTypeLike = "ENTRADA" | "SAIDA";

export interface TransactionLike {
  id: string;
  date: Date;
  description: string;
  amountCents: number;
  type: TransactionTypeLike;
  accountId: string;
  categoryId: string | null;
}

export interface AccountLike {
  id: string;
  name: string;
  type: string;
  openingBalanceCents: number;
  color: string;
  archived: boolean;
}

export interface CategoryLike {
  id: string;
  name: string;
  type: TransactionTypeLike;
  color: string;
}

/** Converte o sinal do lançamento: entrada soma, saída subtrai. */
export function signedCents(tx: { amountCents: number; type: TransactionTypeLike }) {
  return tx.type === "ENTRADA" ? tx.amountCents : -tx.amountCents;
}

export interface PeriodTotals {
  incomeCents: number;
  expenseCents: number;
  /** Entradas − saídas do período. Negativo significa que o mês fechou no vermelho. */
  balanceCents: number;
  transactionCount: number;
  /** Percentual das entradas que sobrou. 0 quando não houve entrada. */
  savingsRate: number;
  biggestExpense: TransactionLike | null;
}

export function summarizeTransactions(transactions: TransactionLike[]): PeriodTotals {
  let incomeCents = 0;
  let expenseCents = 0;
  let biggestExpense: TransactionLike | null = null;

  for (const tx of transactions) {
    if (tx.type === "ENTRADA") {
      incomeCents += tx.amountCents;
    } else {
      expenseCents += tx.amountCents;
      if (!biggestExpense || tx.amountCents > biggestExpense.amountCents) biggestExpense = tx;
    }
  }

  const balanceCents = incomeCents - expenseCents;

  return {
    incomeCents,
    expenseCents,
    balanceCents,
    transactionCount: transactions.length,
    savingsRate: incomeCents > 0 ? Math.round((balanceCents / incomeCents) * 100) : 0,
    biggestExpense,
  };
}

export interface DailyFlowPoint {
  day: number;
  label: string;
  incomeCents: number;
  expenseCents: number;
  /** Saldo do dia (entradas − saídas daquele dia). */
  netCents: number;
  /** Saldo acumulado do mês até esse dia — a linha que mostra se o mês fecha no azul. */
  runningCents: number;
}

/**
 * Fluxo dia a dia de um mês, com saldo acumulado.
 *
 * `startingCents` permite começar a linha acumulada do saldo que existia antes
 * do mês (útil para responder "vou fechar o mês no positivo?" considerando o
 * que já havia em caixa).
 */
export function buildDailyFlow(
  transactions: TransactionLike[],
  year: number,
  month: number,
  startingCents = 0
): DailyFlowPoint[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const points: DailyFlowPoint[] = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    label: String(i + 1),
    incomeCents: 0,
    expenseCents: 0,
    netCents: 0,
    runningCents: 0,
  }));

  for (const tx of transactions) {
    const index = tx.date.getDate() - 1;
    if (index < 0 || index >= points.length) continue;
    if (tx.type === "ENTRADA") points[index].incomeCents += tx.amountCents;
    else points[index].expenseCents += tx.amountCents;
  }

  let running = startingCents;
  for (const point of points) {
    point.netCents = point.incomeCents - point.expenseCents;
    running += point.netCents;
    point.runningCents = running;
  }

  return points;
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  name: string;
  color: string;
  totalCents: number;
  /** Participação no total do tipo, em % inteiro. */
  percent: number;
  transactionCount: number;
}

/**
 * Agrupa lançamentos de um tipo por categoria, do maior para o menor.
 * Lançamentos sem categoria caem em "Sem categoria" — nunca são descartados,
 * senão a soma das fatias não bateria com o total exibido nos cards.
 */
export function breakdownByCategory(
  transactions: TransactionLike[],
  categories: CategoryLike[],
  type: TransactionTypeLike
): CategoryBreakdownItem[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const buckets = new Map<string, CategoryBreakdownItem>();
  let total = 0;

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    total += tx.amountCents;

    const key = tx.categoryId ?? "__none__";
    let bucket = buckets.get(key);
    if (!bucket) {
      const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
      bucket = {
        categoryId: tx.categoryId,
        name: category?.name ?? "Sem categoria",
        color: category?.color ?? "#898781",
        totalCents: 0,
        percent: 0,
        transactionCount: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.totalCents += tx.amountCents;
    bucket.transactionCount += 1;
  }

  const items = Array.from(buckets.values()).sort((a, b) => b.totalCents - a.totalCents);
  for (const item of items) {
    item.percent = total > 0 ? Math.round((item.totalCents / total) * 100) : 0;
  }

  return items;
}

export interface AccountBalance extends AccountLike {
  /** Saldo inicial + todos os lançamentos da conta até a data considerada. */
  balanceCents: number;
  transactionCount: number;
}

/**
 * Saldo de cada conta.
 *
 * Recebe TODOS os lançamentos da conta (não só os do mês em tela): o saldo de
 * uma carteira é histórico, não mensal.
 */
export function computeAccountBalances(
  accounts: AccountLike[],
  allTransactions: TransactionLike[]
): AccountBalance[] {
  const byAccount = new Map<string, { total: number; count: number }>();

  for (const tx of allTransactions) {
    const entry = byAccount.get(tx.accountId) ?? { total: 0, count: 0 };
    entry.total += signedCents(tx);
    entry.count += 1;
    byAccount.set(tx.accountId, entry);
  }

  return accounts.map((account) => {
    const entry = byAccount.get(account.id);
    return {
      ...account,
      balanceCents: account.openingBalanceCents + (entry?.total ?? 0),
      transactionCount: entry?.count ?? 0,
    };
  });
}

export interface RecurrenceLike {
  id: string;
  frequency: "MENSAL" | "SEMANAL" | "ANUAL";
  dayOfMonth: number;
  weekday: number;
  monthOfYear: number;
  startDate: Date;
  endDate: Date | null;
  active: boolean;
}

/**
 * Datas em que uma recorrência deve gerar lançamento dentro de um mês.
 *
 * Regras de borda que importam:
 *  - dia 31 num mês de 30 dias cai no último dia do mês (não pula o mês);
 *  - nada é gerado antes de `startDate` nem depois de `endDate`;
 *  - recorrência inativa não gera nada.
 */
export function occurrencesInMonth(recurrence: RecurrenceLike, year: number, month: number): Date[] {
  if (!recurrence.active) return [];

  const daysInMonth = new Date(year, month, 0).getDate();
  const candidates: Date[] = [];

  switch (recurrence.frequency) {
    case "MENSAL": {
      candidates.push(new Date(year, month - 1, Math.min(recurrence.dayOfMonth, daysInMonth)));
      break;
    }
    case "ANUAL": {
      if (recurrence.monthOfYear === month) {
        candidates.push(new Date(year, month - 1, Math.min(recurrence.dayOfMonth, daysInMonth)));
      }
      break;
    }
    case "SEMANAL": {
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        if (date.getDay() === recurrence.weekday) candidates.push(date);
      }
      break;
    }
  }

  const start = startOfDayLocal(recurrence.startDate);
  const end = recurrence.endDate ? startOfDayLocal(recurrence.endDate) : null;

  return candidates.filter((date) => {
    if (date.getTime() < start.getTime()) return false;
    if (end && date.getTime() > end.getTime()) return false;
    return true;
  });
}

function startOfDayLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/* ------------------------------- formatação ------------------------------ */

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function centsToBRL(cents: number) {
  return currencyFormatter.format((Number.isFinite(cents) ? cents : 0) / 100);
}

/** Versão compacta para eixos de gráfico: R$ 1,2 mil. */
export function centsToBRLCompact(cents: number) {
  return compactFormatter.format((Number.isFinite(cents) ? cents : 0) / 100);
}

/** Sempre com sinal explícito — usado onde a direção do dinheiro é a informação. */
export function centsToSignedBRL(cents: number) {
  const formatted = centsToBRL(Math.abs(cents));
  if (cents > 0) return `+${formatted}`;
  if (cents < 0) return `−${formatted}`;
  return formatted;
}

/**
 * Converte o texto digitado no formulário para centavos.
 *
 * Aceita as formas que o usuário brasileiro realmente digita: "1.234,56",
 * "1234,56", "1234.56" e "1234". A heurística: se houver vírgula, ela é o
 * separador decimal e os pontos são de milhar; sem vírgula, um único ponto com
 * até 2 casas finais é decimal, e qualquer outro ponto é milhar.
 */
export function parseAmountToCents(input: string): number | null {
  const raw = input.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!raw) return null;

  let normalized: string;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(raw)) {
    normalized = raw;
  } else {
    normalized = raw.replace(/\./g, "");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MONTH_SHORT_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CORRENTE: "Conta corrente",
  POUPANCA: "Poupança",
  CARTEIRA: "Carteira",
  CARTAO: "Cartão de crédito",
  INVESTIMENTO: "Investimento",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  MENSAL: "Mensal",
  SEMANAL: "Semanal",
  ANUAL: "Anual",
};
