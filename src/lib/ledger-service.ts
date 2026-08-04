import { endOfMonth, startOfMonth, startOfYear, endOfYear } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  breakdownByCategory,
  buildDailyFlow,
  computeAccountBalances,
  occurrencesInMonth,
  signedCents,
  summarizeTransactions,
  MONTH_SHORT_NAMES,
  type AccountBalance,
  type CategoryBreakdownItem,
  type DailyFlowPoint,
  type PeriodTotals,
  type TransactionLike,
} from "@/lib/ledger-calc";

/**
 * Camada de acesso a dados do razão financeiro.
 *
 * Segue o mesmo desenho de `src/lib/time-service.ts`: aqui ficam as consultas
 * ao Prisma; toda a matemática mora em `src/lib/ledger-calc.ts`.
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
  const monthStart = startOfMonth(new Date(year, month - 1, 1));

  const recurrences = await prisma.recurringTransaction.findMany({
    where: { userId, active: true, startDate: { lte: endOfMonth(monthStart) } },
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

/** Saldo consolidado de todas as contas ANTES de uma data — o "caixa inicial" do mês. */
export async function getBalanceBefore(userId: string, date: Date): Promise<number> {
  const [accounts, aggregate] = await Promise.all([
    prisma.account.aggregate({ where: { userId }, _sum: { openingBalanceCents: true } }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { userId, date: { lt: date } },
      _sum: { amountCents: true },
    }),
  ]);

  const opening = accounts._sum.openingBalanceCents ?? 0;
  const movement = aggregate.reduce(
    (acc, row) => acc + signedCents({ amountCents: row._sum.amountCents ?? 0, type: row.type }),
    0
  );

  return opening + movement;
}

export interface MonthSeriesPoint {
  month: number;
  label: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  isFuture: boolean;
}

export interface LedgerOverview {
  year: number;
  month: number;
  totals: PeriodTotals;
  /** Caixa de todas as contas somado no fim do mês selecionado. */
  closingCents: number;
  openingCents: number;
  transactions: (TransactionLike & {
    notes: string | null;
    recurringId: string | null;
    accountName: string;
    accountColor: string;
    categoryName: string | null;
    categoryColor: string | null;
  })[];
  dailyFlow: DailyFlowPoint[];
  expensesByCategory: CategoryBreakdownItem[];
  incomeByCategory: CategoryBreakdownItem[];
  accounts: AccountBalance[];
  categories: { id: string; name: string; type: "ENTRADA" | "SAIDA"; color: string }[];
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
 * Monta, em uma tacada, tudo que a página /financeiro precisa.
 *
 * Ordem importa: as recorrências são materializadas ANTES de ler os lançamentos
 * do mês, senão o aluguel do mês corrente só apareceria no segundo refresh.
 */
export async function getLedgerOverview(
  userId: string,
  year: number,
  month: number,
  referenceDate: Date = new Date()
): Promise<LedgerOverview> {
  await ensureLedgerBootstrap(userId);
  await materializeRecurrences(userId, year, month);

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const yearStart = startOfYear(monthStart);
  const yearEnd = endOfYear(monthStart);

  const [monthRows, accountRows, categoryRows, recurrenceRows, yearRows, openingCents] =
    await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: monthStart, lte: monthEnd } },
        include: { account: true, category: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.category.findMany({
        where: { userId, archived: false },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      prisma.recurringTransaction.findMany({
        where: { userId },
        include: { account: true, category: true },
        orderBy: [{ active: "desc" }, { dayOfMonth: "asc" }],
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: yearStart, lte: yearEnd } },
        select: { date: true, amountCents: true, type: true },
      }),
      getBalanceBefore(userId, monthStart),
    ]);

  // O saldo de cada conta é histórico, não mensal — precisa de todos os
  // lançamentos, não só os do mês em tela.
  const allForBalance = await prisma.transaction.findMany({
    where: { userId, date: { lte: monthEnd } },
    select: { id: true, date: true, description: true, amountCents: true, type: true, accountId: true, categoryId: true },
  });

  const transactions = monthRows.map((tx) => ({
    id: tx.id,
    date: tx.date,
    description: tx.description,
    amountCents: tx.amountCents,
    type: tx.type,
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    notes: tx.notes,
    recurringId: tx.recurringId,
    accountName: tx.account.name,
    accountColor: tx.account.color,
    categoryName: tx.category?.name ?? null,
    categoryColor: tx.category?.color ?? null,
  }));

  const categories = categoryRows.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    color: c.color,
  }));

  const totals = summarizeTransactions(transactions);

  const byMonth = new Map<number, { income: number; expense: number }>();
  for (const row of yearRows) {
    const key = row.date.getMonth();
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

  return {
    year,
    month,
    totals,
    openingCents,
    closingCents: openingCents + totals.balanceCents,
    transactions,
    dailyFlow: buildDailyFlow(transactions, year, month, openingCents),
    expensesByCategory: breakdownByCategory(transactions, categories, "SAIDA"),
    incomeByCategory: breakdownByCategory(transactions, categories, "ENTRADA"),
    accounts: computeAccountBalances(
      accountRows.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        openingBalanceCents: a.openingBalanceCents,
        color: a.color,
        archived: a.archived,
      })),
      allForBalance
    ),
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

/**
 * Mesmo que getLedgerOverview, mas filtrando por conta específica se `accountId` for fornecido.
 *
 * Quando accountId é fornecido:
 * - Transações são filtradas apenas dessa conta
 * - Gráficos mostram apenas dados dessa conta
 * - Saldos iniciais e finais são apenas dessa conta
 *
 * Quando accountId é null, comporta-se como getLedgerOverview (todas as contas).
 */
export async function getLedgerOverviewFiltered(
  userId: string,
  year: number,
  month: number,
  accountId: string | null,
  referenceDate: Date = new Date()
): Promise<LedgerOverview> {
  const overview = await getLedgerOverview(userId, year, month, referenceDate);

  if (!accountId) {
    return overview;
  }

  // Filtrar transações pela conta
  const filteredTransactions = overview.transactions.filter((tx) => tx.accountId === accountId);

  // Recalcular totais baseado nas transações filtradas
  const filteredTotals = summarizeTransactions(filteredTransactions);

  // Calcular saldo inicial apenas dessa conta
  const account = overview.accounts.find((a) => a.id === accountId);
  const accountOpeningBalance = account?.balanceCents ?? 0;

  // Recalcular fluxo diário
  const filteredDailyFlow = buildDailyFlow(filteredTransactions, year, month, accountOpeningBalance);

  // Recalcular breakdown por categoria
  const filteredExpensesByCategory = breakdownByCategory(filteredTransactions, overview.categories, "SAIDA");
  const filteredIncomeByCategory = breakdownByCategory(filteredTransactions, overview.categories, "ENTRADA");

  // Filtrar recorrências dessa conta
  const filteredRecurrences = overview.recurrences.filter((r) => r.accountId === accountId);

  return {
    ...overview,
    totals: filteredTotals,
    openingCents: accountOpeningBalance,
    closingCents: accountOpeningBalance + filteredTotals.balanceCents,
    transactions: filteredTransactions,
    dailyFlow: filteredDailyFlow,
    expensesByCategory: filteredExpensesByCategory,
    incomeByCategory: filteredIncomeByCategory,
    recurrences: filteredRecurrences,
  };
}
