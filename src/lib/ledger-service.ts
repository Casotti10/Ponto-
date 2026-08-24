import { prisma } from "@/lib/prisma";
import {
  breakdownByCategory,
  buildDailyFlow,
  computeAccountBalancesFromTotals,
  isCancelled,
  isOverdue,
  isSettled,
  isTransfer,
  ledgerMonthOf,
  ledgerMonthRange,
  ledgerYearRange,
  occurrencesInMonth,
  signedCents,
  summarizeTransactions,
  MONTH_NAMES,
  MONTH_SHORT_NAMES,
  type AccountBalance,
  type CategoryBreakdownItem,
  type DailyFlowPoint,
  type PeriodTotals,
  type TransactionLike,
  type TransactionStatusLike,
} from "@/lib/ledger-calc";

/**
 * Camada de acesso a dados do razão financeiro.
 *
 * Segue o mesmo desenho de `src/lib/time-service.ts`: aqui ficam as consultas
 * ao Prisma; toda a matemática mora em `src/lib/ledger-calc.ts`.
 *
 * DUAS LEITURAS, DOIS PROPÓSITOS — e elas não se misturam:
 *
 *  - `getMonthlyLedger`  → a VISÃO MENSAL. Recorta um mês/ano e só ele.
 *  - `getLedgerHistory`  → a VISÃO GERAL. Todo o histórico, com paginação.
 *
 * Em ambas o recorte é cláusula `where` no Prisma, nunca `.filter()` sobre um
 * conjunto maior já carregado: trocar de mês na tela precisa virar uma consulta
 * nova ao banco, senão o "filtro" seria só a UI escondendo linhas.
 */

/** Categorias criadas na primeira visita, para o usuário não começar no vazio. */
const SEED_CATEGORIES: { name: string; type: "ENTRADA" | "SAIDA"; color: string }[] = [
  { name: "Salário", type: "ENTRADA", color: "#1baf7a" },
  { name: "Freelance", type: "ENTRADA", color: "#2a78d6" },
  { name: "Outras receitas", type: "ENTRADA", color: "#4a3aa7" },
  // Cores nas 6 primeiras posições da paleta validada (src/lib/chart-colors.ts),
  // na ordem em que as categorias tendem a aparecer nos gráficos.
  { name: "Moradia", type: "SAIDA", color: "#2a78d6" },
  { name: "Alimentação", type: "SAIDA", color: "#e34948" },
  { name: "Transporte", type: "SAIDA", color: "#1baf7a" },
  { name: "Saúde", type: "SAIDA", color: "#eda100" },
  { name: "Lazer", type: "SAIDA", color: "#4a3aa7" },
  { name: "Educação", type: "SAIDA", color: "#e87ba4" },
  { name: "Outros gastos", type: "SAIDA", color: "#898781" },
];

/** Lançamento pronto para a tela: já com nome e cor de conta e categoria. */
export interface LedgerTransaction extends TransactionLike {
  notes: string | null;
  recurringId: string | null;
  settledDate: Date | null;
  paymentMethod: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  accountName: string;
  accountColor: string;
  categoryName: string | null;
  categoryColor: string | null;
}

export interface LedgerCategory {
  id: string;
  name: string;
  type: "ENTRADA" | "SAIDA";
  color: string;
}

/** O `select` que transforma uma linha do Prisma em `LedgerTransaction`. */
const TRANSACTION_INCLUDE = {
  account: { select: { name: true, color: true } },
  category: { select: { name: true, color: true } },
} as const;

type TransactionRow = {
  id: string;
  date: Date;
  description: string;
  amountCents: number;
  type: "ENTRADA" | "SAIDA";
  accountId: string;
  categoryId: string | null;
  notes: string | null;
  recurringId: string | null;
  status: TransactionStatusLike;
  dueDate: Date | null;
  settledDate: Date | null;
  paymentMethod: string | null;
  transferGroupId: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  account: { name: string; color: string };
  category: { name: string; color: string } | null;
};

function toLedgerTransaction(tx: TransactionRow): LedgerTransaction {
  return {
    id: tx.id,
    date: tx.date,
    description: tx.description,
    amountCents: tx.amountCents,
    type: tx.type,
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    notes: tx.notes,
    recurringId: tx.recurringId,
    status: tx.status,
    dueDate: tx.dueDate,
    settledDate: tx.settledDate,
    paymentMethod: tx.paymentMethod,
    transferGroupId: tx.transferGroupId,
    installmentGroupId: tx.installmentGroupId,
    installmentNumber: tx.installmentNumber,
    installmentTotal: tx.installmentTotal,
    accountName: tx.account.name,
    accountColor: tx.account.color,
    categoryName: tx.category?.name ?? null,
    categoryColor: tx.category?.color ?? null,
  };
}

/**
 * Garante que o usuário tenha ao menos uma conta e o conjunto inicial de
 * categorias. `createMany` com `skipDuplicates` apoiado nos índices únicos
 * torna a chamada idempotente — pode rodar em toda visita sem duplicar nada.
 */
export async function ensureLedgerBootstrap(userId: string) {
  const accountCount = await prisma.account.count({ where: { userId } });

  if (accountCount === 0) {
    await prisma.account.create({
      data: { userId, name: "Conta principal", type: "CORRENTE", color: "#2a78d6" },
    });
  }

  const categoryCount = await prisma.category.count({ where: { userId } });
  if (categoryCount === 0) {
    await prisma.category.createMany({
      data: SEED_CATEGORIES.map((c) => ({ ...c, userId })),
      skipDuplicates: true,
    });
  }
}

/**
 * Materializa os lançamentos das recorrências ativas dentro de um mês.
 *
 * É idempotente por construção: `Transaction` tem `@@unique([recurringId, date])`,
 * então `skipDuplicates` descarta o que já existe. Isso permite chamar a função
 * a cada carregamento da página sem medo de duplicar o aluguel.
 *
 * Lançamento gerado é um lançamento normal — o usuário pode editar ou apagar
 * sem que a recorrência o recrie (a unicidade só impede a duplicata; se o
 * usuário apagar, a próxima visita recria, o que é o comportamento esperado de
 * "essa conta existe todo mês").
 */
export async function materializeRecurrences(userId: string, year: number, month: number) {
  const { end } = ledgerMonthRange(year, month);

  const recurrences = await prisma.recurringTransaction.findMany({
    where: { userId, active: true, startDate: { lte: end } },
  });
  if (recurrences.length === 0) return 0;

  const rows = recurrences.flatMap((recurrence) =>
    occurrencesInMonth(recurrence, year, month).map((date) => ({
      userId,
      accountId: recurrence.accountId,
      categoryId: recurrence.categoryId,
      date,
      description: recurrence.description,
      amountCents: recurrence.amountCents,
      type: recurrence.type,
      recurringId: recurrence.id,
    }))
  );
  if (rows.length === 0) return 0;

  const result = await prisma.transaction.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

/**
 * Saldo consolidado ANTES de uma data — o "caixa inicial" do mês.
 *
 * Com `accountId`, considera só o saldo inicial e os lançamentos daquela conta:
 * quando o usuário filtra por um banco, o saldo de abertura tem que ser o
 * daquele banco, não o de todos somados.
 */
export async function getBalanceBefore(
  userId: string,
  date: Date,
  accountId: string | null = null
): Promise<number> {
  const accountWhere = accountId ? { id: accountId, userId } : { userId };

  const [accounts, movements] = await Promise.all([
    prisma.account.aggregate({ where: accountWhere, _sum: { openingBalanceCents: true } }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: {
        userId,
        date: { lt: date },
        // Caixa inicial é dinheiro que EXISTE. Uma conta pendente do mês
        // passado não o reduziu, e uma cancelada nunca chegou a existir.
        status: "LIQUIDADO",
        ...(accountId ? { accountId } : {}),
      },
      _sum: { amountCents: true },
    }),
  ]);

  const opening = accounts._sum.openingBalanceCents ?? 0;
  const movement = movements.reduce(
    (acc, row) => acc + signedCents({ amountCents: row._sum.amountCents ?? 0, type: row.type }),
    0
  );

  return opening + movement;
}

/** Saldo líquido (entradas − saídas) de um mês. Consulta agregada, sem trazer linhas. */
export async function getMonthNetCents(
  userId: string,
  year: number,
  month: number,
  accountId: string | null = null
): Promise<number> {
  const { start, end } = ledgerMonthRange(year, month);

  const rows = await prisma.transaction.groupBy({
    by: ["type"],
    // Série anual e comparativo entre meses falam de dinheiro que se moveu.
    where: {
      userId,
      date: { gte: start, lte: end },
      status: "LIQUIDADO",
      ...(accountId ? { accountId } : {}),
    },
    _sum: { amountCents: true },
  });

  return rows.reduce(
    (acc, row) => acc + signedCents({ amountCents: row._sum.amountCents ?? 0, type: row.type }),
    0
  );
}

export interface MonthSeriesPoint {
  month: number;
  label: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  isFuture: boolean;
}

export interface MonthlyLedger {
  year: number;
  month: number;
  totals: PeriodTotals;
  /** Caixa somado no início do mês selecionado. */
  openingCents: number;
  /** Caixa no fim do mês: abertura + saldo do mês. */
  closingCents: number;
  /** Saldo líquido do mês anterior, para a comparação do resumo. */
  previousNetCents: number;
  transactions: LedgerTransaction[];
  dailyFlow: DailyFlowPoint[];
  expensesByCategory: CategoryBreakdownItem[];
  incomeByCategory: CategoryBreakdownItem[];
  /** Contas no escopo do filtro — é sobre elas que "dinheiro em caixa" soma. */
  accounts: AccountBalance[];
  /** Todas as contas, sempre. O gerenciador de contas não deve sumir com o filtro. */
  allAccounts: AccountBalance[];
  categories: LedgerCategory[];
  recurrences: {
    id: string;
    description: string;
    amountCents: number;
    type: "ENTRADA" | "SAIDA";
    frequency: string;
    dayOfMonth: number;
    weekday: number;
    monthOfYear: number;
    active: boolean;
    accountId: string;
    accountName: string;
    categoryId: string | null;
    categoryName: string | null;
    startDate: Date;
    endDate: Date | null;
  }[];
  yearSeries: MonthSeriesPoint[];
}

/**
 * VISÃO MENSAL: tudo que a página /financeiro precisa de UM mês.
 *
 * O recorte `date >= início do mês AND date <= fim do mês` é cláusula do Prisma
 * (índice `[userId, date]`), assim como o filtro de conta. Trocar de mês na
 * interface reexecuta este Server Component e, com ele, esta consulta — os
 * lançamentos de agosto nunca chegam a ser carregados quando a tela está em
 * setembro.
 *
 * Ordem importa: as recorrências são materializadas ANTES de ler os lançamentos
 * do mês, senão o aluguel do mês corrente só apareceria no segundo refresh.
 */
export async function getMonthlyLedger(
  userId: string,
  year: number,
  month: number,
  accountId: string | null = null,
  referenceDate: Date = new Date()
): Promise<MonthlyLedger> {
  await ensureLedgerBootstrap(userId);
  await materializeRecurrences(userId, year, month);

  const { start: monthStart, end: monthEnd } = ledgerMonthRange(year, month);
  const { start: yearStart, end: yearEnd } = ledgerYearRange(year);
  const accountScope = accountId ? { accountId } : {};

  const [monthRows, accountRows, categoryRows, recurrenceRows, yearRows, balanceTotals, openingCents] =
    await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: monthStart, lte: monthEnd }, ...accountScope },
        include: TRANSACTION_INCLUDE,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.category.findMany({
        where: { userId, archived: false },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      prisma.recurringTransaction.findMany({
        where: { userId, ...accountScope },
        include: { account: { select: { name: true } }, category: { select: { name: true } } },
        orderBy: [{ active: "desc" }, { dayOfMonth: "asc" }],
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: yearStart, lte: yearEnd }, ...accountScope },
        select: { date: true, amountCents: true, type: true },
      }),
      // O saldo de cada conta é histórico, não mensal. Somar isso no banco
      // evita carregar todo o passado só para fechar um número.
      prisma.transaction.groupBy({
        by: ["accountId", "type"],
        // Saldo da conta é dinheiro que existe: só o liquidado entra. A
        // transferência entra sim — ela move dinheiro de verdade entre contas.
        where: { userId, date: { lte: monthEnd }, status: "LIQUIDADO" },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      getBalanceBefore(userId, monthStart, accountId),
    ]);

  const transactions = monthRows.map(toLedgerTransaction);
  const categories: LedgerCategory[] = categoryRows.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    color: c.color,
  }));

  const totals = summarizeTransactions(transactions, referenceDate);

  const allAccounts = computeAccountBalancesFromTotals(
    accountRows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      openingBalanceCents: a.openingBalanceCents,
      color: a.color,
      archived: a.archived,
    })),
    balanceTotals.map((row) => ({
      accountId: row.accountId,
      type: row.type,
      amountCents: row._sum.amountCents ?? 0,
      count: row._count._all,
    }))
  );

  const byMonth = new Map<number, { income: number; expense: number }>();
  for (const row of yearRows) {
    const key = ledgerMonthOf(row.date).month - 1;
    const entry = byMonth.get(key) ?? { income: 0, expense: 0 };
    if (row.type === "ENTRADA") entry.income += row.amountCents;
    else entry.expense += row.amountCents;
    byMonth.set(key, entry);
  }

  const yearSeries: MonthSeriesPoint[] = Array.from({ length: 12 }, (_, index) => {
    const entry = byMonth.get(index) ?? { income: 0, expense: 0 };
    return {
      month: index + 1,
      label: MONTH_SHORT_NAMES[index],
      incomeCents: entry.income,
      expenseCents: entry.expense,
      balanceCents: entry.income - entry.expense,
      isFuture: new Date(year, index, 1).getTime() > referenceDate.getTime(),
    };
  });

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousNetCents = await getMonthNetCents(userId, previousYear, previousMonth, accountId);

  return {
    year,
    month,
    totals,
    openingCents,
    closingCents: openingCents + totals.balanceCents,
    previousNetCents,
    transactions,
    dailyFlow: buildDailyFlow(transactions, year, month, openingCents),
    expensesByCategory: breakdownByCategory(transactions, categories, "SAIDA"),
    incomeByCategory: breakdownByCategory(transactions, categories, "ENTRADA"),
    accounts: accountId ? allAccounts.filter((a) => a.id === accountId) : allAccounts,
    allAccounts,
    categories,
    recurrences: recurrenceRows.map((r) => ({
      id: r.id,
      description: r.description,
      amountCents: r.amountCents,
      type: r.type,
      frequency: r.frequency,
      dayOfMonth: r.dayOfMonth,
      weekday: r.weekday,
      monthOfYear: r.monthOfYear,
      active: r.active,
      accountId: r.accountId,
      accountName: r.account.name,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
      startDate: r.startDate,
      endDate: r.endDate,
    })),
    yearSeries,
  };
}

/* ------------------------------- visão geral ------------------------------ */

export interface LedgerHistoryFilters {
  /** `null` = todos os anos. */
  year: number | null;
  accountId: string | null;
  categoryId: string | null;
  type: "ENTRADA" | "SAIDA" | null;
  search: string | null;
  page: number;
  pageSize: number;
}

export interface HistoryMonthRow {
  year: number;
  month: number;
  label: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  transactionCount: number;
}

export interface LedgerHistory {
  transactions: LedgerTransaction[];
  /** Totais de TODO o conjunto filtrado, não só da página exibida. */
  totals: PeriodTotals;
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
  /** Um resumo por mês, do mais recente para o mais antigo. */
  months: HistoryMonthRow[];
  /** Anos que de fato têm lançamentos, para montar o seletor. */
  availableYears: number[];
  firstDate: Date | null;
  lastDate: Date | null;
  accounts: AccountBalance[];
  categories: LedgerCategory[];
}

export const HISTORY_PAGE_SIZE = 50;

/**
 * VISÃO GERAL: o histórico inteiro, sem recorte de mês.
 *
 * Deliberadamente separada de `getMonthlyLedger` — são perguntas diferentes
 * ("quanto gastei em agosto" vs. "o que já lancei desde sempre") e juntá-las é
 * o que produz o sintoma de mês que vaza para mês.
 *
 * A página vem paginada do banco (`skip`/`take`), mas os totais e o resumo por
 * mês são calculados sobre o conjunto filtrado INTEIRO — um total que só
 * somasse a página seria uma resposta errada apresentada com confiança. Para
 * isso a consulta de escopo traz só três colunas por linha.
 */
export async function getLedgerHistory(
  userId: string,
  filters: LedgerHistoryFilters,
  /** "Hoje" para decidir o que está vencido. Injetado para ser testável. */
  referenceDate: Date = new Date()
): Promise<LedgerHistory> {
  await ensureLedgerBootstrap(userId);

  const { year, accountId, categoryId, type, search, pageSize } = filters;

  // Filtros que valem para todas as consultas abaixo, EXCETO o de ano: o
  // seletor de ano precisa listar os anos que existem dentro do resto do
  // filtro, senão escolher uma categoria poderia esconder o próprio ano que
  // está selecionado.
  const baseWhere = {
    userId,
    ...(accountId ? { accountId } : {}),
    ...(categoryId ? { categoryId: categoryId === "__none__" ? null : categoryId } : {}),
    ...(type ? { type } : {}),
    ...(search ? { description: { contains: search, mode: "insensitive" as const } } : {}),
  };

  // O mesmo `baseWhere`, agora com o recorte de ano — é este que pagina.
  const yearRange = year ? ledgerYearRange(year) : null;
  const fullWhere = {
    ...baseWhere,
    ...(yearRange ? { date: { gte: yearRange.start, lte: yearRange.end } } : {}),
  };

  const [scopeRows, totalCount, accountRows, categoryRows, balanceTotals] = await Promise.all([
    prisma.transaction.findMany({
      where: baseWhere,
      // `status`, `dueDate` e `transferGroupId` entram aqui porque os totais da
      // visão geral precisam separar realizado de previsto e excluir cancelado
      // e transferência — sem eles o histórico responderia com outra régua que
      // a visão mensal.
      select: {
        date: true,
        amountCents: true,
        type: true,
        status: true,
        dueDate: true,
        transferGroupId: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.transaction.count({ where: fullWhere }),
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({
      where: { userId, archived: false },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.transaction.groupBy({
      by: ["accountId", "type"],
      // Saldo da conta é dinheiro que existe: só o liquidado entra. A
      // transferência entra sim — ela move dinheiro de verdade entre contas.
      where: { userId, status: "LIQUIDADO" },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
  ]);

  const availableYears = Array.from(
    new Set(scopeRows.map((row) => ledgerMonthOf(row.date).year))
  ).sort((a, b) => b - a);

  const inScope = year
    ? scopeRows.filter((row) => ledgerMonthOf(row.date).year === year)
    : scopeRows;

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, filters.page), pageCount);

  const pageRows = await prisma.transaction.findMany({
    where: fullWhere,
    include: TRANSACTION_INCLUDE,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  let incomeCents = 0;
  let expenseCents = 0;
  let pendingIncomeCents = 0;
  let pendingExpenseCents = 0;
  let overdueIncomeCents = 0;
  let overdueExpenseCents = 0;
  let cancelledCount = 0;
  let transferCount = 0;
  let countedRows = 0;
  const monthMap = new Map<string, HistoryMonthRow>();

  for (const row of inScope) {
    // Mesma régua da visão mensal: cancelado foi desfeito e transferência não é
    // receita nem despesa. Os dois são contados à parte para que a tela possa
    // dizer que existem.
    if (isCancelled(row)) {
      cancelledCount++;
      continue;
    }
    if (isTransfer(row)) {
      transferCount++;
      continue;
    }
    countedRows++;

    const { year: rowYear, month: rowMonth } = ledgerMonthOf(row.date);
    const key = `${rowYear}-${rowMonth}`;
    let bucket = monthMap.get(key);
    if (!bucket) {
      bucket = {
        year: rowYear,
        month: rowMonth,
        label: `${MONTH_NAMES[rowMonth - 1]} de ${rowYear}`,
        incomeCents: 0,
        expenseCents: 0,
        balanceCents: 0,
        transactionCount: 0,
      };
      monthMap.set(key, bucket);
    }

    const settled = isSettled(row);
    const overdue = isOverdue(row, referenceDate);

    if (row.type === "ENTRADA") {
      if (settled) {
        incomeCents += row.amountCents;
        bucket.incomeCents += row.amountCents;
      } else {
        pendingIncomeCents += row.amountCents;
        if (overdue) overdueIncomeCents += row.amountCents;
      }
    } else {
      if (settled) {
        expenseCents += row.amountCents;
        bucket.expenseCents += row.amountCents;
      } else {
        pendingExpenseCents += row.amountCents;
        if (overdue) overdueExpenseCents += row.amountCents;
      }
    }
    bucket.transactionCount += 1;
  }

  const months = Array.from(monthMap.values())
    .map((row) => ({ ...row, balanceCents: row.incomeCents - row.expenseCents }))
    .sort((a, b) => b.year - a.year || b.month - a.month);

  const balanceCents = incomeCents - expenseCents;

  return {
    transactions: pageRows.map(toLedgerTransaction),
    totals: {
      incomeCents,
      expenseCents,
      balanceCents,
      transactionCount: countedRows,
      savingsRate: incomeCents > 0 ? Math.round((balanceCents / incomeCents) * 100) : 0,
      // O maior gasto do histórico exigiria a linha completa; a visão geral já
      // destaca isso pelo resumo mensal, então aqui fica de fora de propósito.
      biggestExpense: null,
      pendingIncomeCents,
      pendingExpenseCents,
      overdueIncomeCents,
      overdueExpenseCents,
      projectedBalanceCents: balanceCents + pendingIncomeCents - pendingExpenseCents,
      cancelledCount,
      transferCount,
    },
    page,
    pageSize,
    pageCount,
    totalCount,
    months,
    availableYears,
    firstDate: inScope.length > 0 ? inScope[0].date : null,
    lastDate: inScope.length > 0 ? inScope[inScope.length - 1].date : null,
    accounts: computeAccountBalancesFromTotals(
      accountRows.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        openingBalanceCents: a.openingBalanceCents,
        color: a.color,
        archived: a.archived,
      })),
      balanceTotals.map((row) => ({
        accountId: row.accountId,
        type: row.type,
        amountCents: row._sum.amountCents ?? 0,
        count: row._count._all,
      }))
    ),
    categories: categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      color: c.color,
    })),
  };
}
