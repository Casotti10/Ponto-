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

export type TransactionStatusLike = "PENDENTE" | "LIQUIDADO" | "AGENDADO" | "CANCELADO";

export interface TransactionLike {
  id: string;
  date: Date;
  description: string;
  amountCents: number;
  type: TransactionTypeLike;
  accountId: string;
  categoryId: string | null;
  /**
   * Opcionais para que os lançamentos lidos antes da coluna existir continuem
   * satisfazendo este tipo. Ausente significa o comportamento histórico:
   * liquidado, sem vencimento próprio e sem transferência.
   */
  status?: TransactionStatusLike;
  dueDate?: Date | null;
  transferGroupId?: string | null;
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

/* --------------------------- integridade financeira ------------------------ */

/**
 * As quatro perguntas que decidem se um lançamento entra numa conta.
 *
 * Estão aqui, juntas e puras, porque cada uma delas errada produz um número
 * plausível e falso — o pior tipo de bug num sistema financeiro. Um lançamento
 * cancelado que continua somando, ou uma transferência contada como receita,
 * não quebram a tela: só mentem.
 */

/** Liquidado = o dinheiro realmente entrou ou saiu. Só isto mexe no saldo. */
export function isSettled(tx: Pick<TransactionLike, "status">): boolean {
  // Ausente = histórico anterior à coluna, quando tudo era realizado.
  return (tx.status ?? "LIQUIDADO") === "LIQUIDADO";
}

export function isCancelled(tx: Pick<TransactionLike, "status">): boolean {
  return tx.status === "CANCELADO";
}

/**
 * Perna de uma transferência entre contas próprias. Conta no saldo da conta
 * dela, mas nunca como receita nem como despesa: transferir R$ 500 da corrente
 * para a poupança não é ganhar nem gastar R$ 500.
 */
export function isTransfer(tx: Pick<TransactionLike, "transferGroupId">): boolean {
  return !!tx.transferGroupId;
}

/**
 * Vencido é DERIVADO, nunca armazenado. Guardar como estado exigiria um job
 * virando registro à meia-noite, e entre a virada e a execução o banco estaria
 * mentindo. Aqui a resposta é sempre a de agora.
 */
export function isOverdue(
  tx: Pick<TransactionLike, "status" | "dueDate" | "date">,
  today: Date
): boolean {
  if ((tx.status ?? "LIQUIDADO") !== "PENDENTE") return false;
  const due = tx.dueDate ?? tx.date;
  return due.getTime() < startOfLedgerDay(today).getTime();
}

/** Entra no resultado do período (receitas − despesas). */
export function countsForResult(tx: TransactionLike): boolean {
  return !isCancelled(tx) && !isTransfer(tx);
}

/** Entra no saldo real da conta. */
export function countsForBalance(tx: TransactionLike): boolean {
  return isSettled(tx) && !isCancelled(tx);
}

/** Meia-noite UTC do dia de uma data — mesma convenção de `ledgerDayFromISO`. */
export function startOfLedgerDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/* ------------------------------ o dia contábil ----------------------------- */

/**
 * SEGUNDA REGRA DE OURO: um lançamento pertence a um DIA DE CALENDÁRIO, não a
 * um instante.
 *
 * `new Date("2026-08-01T00:00:00")` resolve a string no fuso do PROCESSO — UTC
 * na Vercel, `America/Sao_Paulo` na máquina de desenvolvimento. O mesmo
 * lançamento passa a ocupar instantes diferentes conforme onde foi gravado, e a
 * janela do mês, montada do mesmo jeito no fuso do processo, deixa de bater com
 * ele: um lançamento do dia 1º gravado em produção (00:00Z) cai em JULHO quando
 * lido de uma máquina em São Paulo, cuja janela de agosto começa às 03:00Z.
 *
 * As funções abaixo tiram o fuso da conta: o dia é sempre meia-noite UTC, a
 * janela do mês é sempre UTC e a leitura usa os getters UTC. Escrita e leitura
 * concordam em qualquer ambiente — é isso que faz a separação mensal ser uma
 * propriedade do DADO, e não do servidor que respondeu à requisição.
 *
 * Difere de `src/lib/timezone.ts` de propósito: lá o que importa é o relógio de
 * parede do usuário (que hora ele bateu o ponto); aqui não existe hora, só a
 * data que ele digitou no formulário.
 */
export function ledgerDayFromISO(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Inverso de `ledgerDayFromISO` — o formato que o `<input type="date">` espera. */
export function ledgerDayToISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Janela `[start, end]` de um mês. É esse par que vai para o `where` do Prisma:
 * o recorte mensal acontece no banco, não em memória.
 */
export function ledgerMonthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    // Último milissegundo do mês: `Date.UTC(year, month, 1)` já é o 1º do mês
    // seguinte, então voltar 1ms fecha o intervalo sem depender de quantos dias
    // o mês tem.
    end: new Date(Date.UTC(year, month, 1) - 1),
  };
}

/** Janela `[start, end]` de um ano inteiro, mesma convenção. */
export function ledgerYearRange(year: number) {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1) - 1),
  };
}

/** Dia do mês do lançamento, lido na mesma convenção em que foi gravado. */
export function ledgerDayOfMonth(date: Date) {
  return date.getUTCDate();
}

/** Mês/ano a que o lançamento pertence — a chave da separação mensal. */
export function ledgerMonthOf(date: Date) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Quantidade de dias do mês, sem depender do fuso do processo. */
export function ledgerDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export interface PeriodTotals {
  /** REALIZADO: entradas que de fato foram recebidas. */
  incomeCents: number;
  /** REALIZADO: saídas que de fato foram pagas. */
  expenseCents: number;
  /** Entradas − saídas realizadas. Negativo significa que o mês fechou no vermelho. */
  balanceCents: number;
  transactionCount: number;
  /** Percentual das entradas que sobrou. 0 quando não houve entrada. */
  savingsRate: number;
  biggestExpense: TransactionLike | null;

  /** PREVISTO: a receber (entradas pendentes ou agendadas). */
  pendingIncomeCents: number;
  /** PREVISTO: a pagar (saídas pendentes ou agendadas). */
  pendingExpenseCents: number;
  /** Do que está pendente, o que já passou do vencimento. */
  overdueIncomeCents: number;
  overdueExpenseCents: number;
  /** Realizado + tudo que ainda está previsto para o período. */
  projectedBalanceCents: number;

  cancelledCount: number;
  transferCount: number;
}

/**
 * Totais do período, separando o que ACONTECEU do que está PREVISTO.
 *
 * Misturar os dois é o erro que faz o app dizer que há dinheiro em caixa que
 * não existe: uma despesa lançada para o mês que vem não pode reduzir o saldo
 * de hoje, e uma receita ainda não recebida não pode aumentá-lo.
 *
 * Cancelados e transferências ficam de fora dos dois lados — o primeiro porque
 * foi desfeito, a segunda porque mover dinheiro entre contas próprias não é
 * receita nem despesa. Ambos continuam contados, separadamente, para que a tela
 * possa dizer que existem.
 */
export function summarizeTransactions(
  transactions: TransactionLike[],
  today: Date = new Date()
): PeriodTotals {
  let incomeCents = 0;
  let expenseCents = 0;
  let pendingIncomeCents = 0;
  let pendingExpenseCents = 0;
  let overdueIncomeCents = 0;
  let overdueExpenseCents = 0;
  let cancelledCount = 0;
  let transferCount = 0;
  let counted = 0;
  let biggestExpense: TransactionLike | null = null;

  for (const tx of transactions) {
    if (isCancelled(tx)) {
      cancelledCount++;
      continue;
    }
    if (isTransfer(tx)) {
      transferCount++;
      continue;
    }

    counted++;
    const settled = isSettled(tx);
    const overdue = isOverdue(tx, today);

    if (tx.type === "ENTRADA") {
      if (settled) incomeCents += tx.amountCents;
      else {
        pendingIncomeCents += tx.amountCents;
        if (overdue) overdueIncomeCents += tx.amountCents;
      }
    } else {
      if (settled) {
        expenseCents += tx.amountCents;
        // "Maior despesa" é sobre dinheiro que saiu, não sobre previsão.
        if (!biggestExpense || tx.amountCents > biggestExpense.amountCents) biggestExpense = tx;
      } else {
        pendingExpenseCents += tx.amountCents;
        if (overdue) overdueExpenseCents += tx.amountCents;
      }
    }
  }

  const balanceCents = incomeCents - expenseCents;

  return {
    incomeCents,
    expenseCents,
    balanceCents,
    transactionCount: counted,
    savingsRate: incomeCents > 0 ? Math.round((balanceCents / incomeCents) * 100) : 0,
    biggestExpense,
    pendingIncomeCents,
    pendingExpenseCents,
    overdueIncomeCents,
    overdueExpenseCents,
    projectedBalanceCents: balanceCents + pendingIncomeCents - pendingExpenseCents,
    cancelledCount,
    transferCount,
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
  const daysInMonth = ledgerDaysInMonth(year, month);
  const points: DailyFlowPoint[] = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    label: String(i + 1),
    incomeCents: 0,
    expenseCents: 0,
    netCents: 0,
    runningCents: 0,
  }));

  for (const tx of transactions) {
    // O fluxo de caixa é a linha do dinheiro que se moveu. Previsto, cancelado
    // e transferência ficam de fora: o saldo acumulado que sai daqui precisa
    // fechar com o saldo real da conta.
    if (!countsForResult(tx) || !isSettled(tx)) continue;

    const index = ledgerDayOfMonth(tx.date) - 1;
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
    // "Onde meu dinheiro foi" é sobre gasto realizado. Cancelado foi desfeito e
    // transferência não é gasto — nenhum dos dois pertence à rosca.
    if (!countsForResult(tx) || !isSettled(tx)) continue;
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
    // SALDO REAL: só o que foi liquidado. Uma despesa pendente não pode reduzir
    // o dinheiro que existe hoje, e uma receita a receber não pode aumentá-lo.
    // Transferência ENTRA aqui de propósito — ela move dinheiro de verdade
    // entre contas, mesmo não sendo receita nem despesa.
    if (!countsForBalance(tx)) continue;

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

/**
 * Mesma conta de `computeAccountBalances`, mas a partir de totais já somados
 * pelo banco (`groupBy` por conta e tipo).
 *
 * Existe para não trazer a tabela inteira de lançamentos para a memória só para
 * somar: o saldo de uma conta é histórico, então o recorte "todos os
 * lançamentos até o fim do mês" cresce para sempre. O `groupBy` devolve uma
 * linha por conta/tipo e o custo para de acompanhar o tamanho do histórico.
 */
export function computeAccountBalancesFromTotals(
  accounts: AccountLike[],
  totals: { accountId: string; type: TransactionTypeLike; amountCents: number; count: number }[]
): AccountBalance[] {
  const byAccount = new Map<string, { total: number; count: number }>();

  for (const row of totals) {
    const entry = byAccount.get(row.accountId) ?? { total: 0, count: 0 };
    entry.total += signedCents(row);
    entry.count += row.count;
    byAccount.set(row.accountId, entry);
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

  const daysInMonth = ledgerDaysInMonth(year, month);
  const dayOf = (day: number) => new Date(Date.UTC(year, month - 1, day));
  const candidates: Date[] = [];

  switch (recurrence.frequency) {
    case "MENSAL": {
      candidates.push(dayOf(Math.min(recurrence.dayOfMonth, daysInMonth)));
      break;
    }
    case "ANUAL": {
      if (recurrence.monthOfYear === month) {
        candidates.push(dayOf(Math.min(recurrence.dayOfMonth, daysInMonth)));
      }
      break;
    }
    case "SEMANAL": {
      for (let day = 1; day <= daysInMonth; day++) {
        const date = dayOf(day);
        if (date.getUTCDay() === recurrence.weekday) candidates.push(date);
      }
      break;
    }
  }

  const start = startOfLedgerDay(recurrence.startDate);
  const end = recurrence.endDate ? startOfLedgerDay(recurrence.endDate) : null;

  return candidates.filter((date) => {
    if (date.getTime() < start.getTime()) return false;
    if (end && date.getTime() > end.getTime()) return false;
    return true;
  });
}

/* ------------------------------- formatação ------------------------------ */

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

// `timeZone: "UTC"` não é detalhe: o dia contábil é gravado em meia-noite UTC,
// então formatá-lo no fuso do processo exibiria "31 de jul" para um lançamento
// de 1º de agosto em qualquer máquina a oeste de Greenwich.
const dayMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
});
const fullDateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

/** "01 de ago" — rótulo curto da lista de lançamentos. */
export function formatLedgerDay(date: Date) {
  return dayMonthFormatter.format(date).replace(".", "");
}

/** "01/08/2026" — data completa, para exportações e a visão geral. */
export function formatLedgerDate(date: Date) {
  return fullDateFormatter.format(date);
}

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
