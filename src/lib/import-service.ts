import { createHash } from "crypto";
import type { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ledgerDayFromISO, MONTH_NAMES } from "@/lib/ledger-calc";
import { categoryPalette } from "@/lib/chart-colors";
import { normalizeText, type ParsedEntry, type ParsedStatement, type SkippedRow } from "@/lib/statement-parser";

/**
 * Importação de extrato bancário para o razão.
 *
 * Duas responsabilidades que valem separar do parser: decidir o que já existe
 * (deduplicação) e adivinhar a categoria de cada gasto (o que faz o gráfico de
 * pizza ter serventia no dia seguinte à importação).
 *
 * A data de cada lançamento passa por `ledgerDayFromISO`, o mesmo helper do
 * formulário manual. É isso que garante que um gasto de 01/09 apareça em
 * setembro e não em agosto, independentemente do fuso do servidor que atendeu
 * o upload.
 */

/** Teto por arquivo. Extrato de um ano num banco movimentado não passa disso. */
export const MAX_ENTRIES_PER_IMPORT = 5000;

export type CandidateStatus = "NOVO" | "JA_IMPORTADO" | "POSSIVEL_DUPLICADO";

export interface ImportCandidate {
  externalId: string;
  date: string;
  description: string;
  amountCents: number;
  type: TransactionType;
  status: CandidateStatus;
  /** Categoria existente que será aplicada, se houver. */
  categoryId: string | null;
  categoryName: string | null;
  /** Categoria que a regra sugeriu mas que o usuário ainda não tem cadastrada. */
  suggestedCategoryName: string | null;
}

export interface MonthBucket {
  year: number;
  month: number;
  label: string;
  count: number;
  incomeCents: number;
  expenseCents: number;
}

export interface ImportPreview {
  format: ParsedStatement["format"];
  bankId: string | null;
  statementAccountId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  candidates: ImportCandidate[];
  skipped: SkippedRow[];
  summary: {
    total: number;
    novos: number;
    jaImportados: number;
    possiveisDuplicados: number;
    incomeCents: number;
    expenseCents: number;
    /** Distribuição por mês — a prova visível de que a separação mensal pega. */
    byMonth: MonthBucket[];
    categoriesToCreate: { name: string; type: TransactionType }[];
  };
}

export interface ImportResult {
  imported: number;
  skippedExisting: number;
  categoriesCreated: number;
  byMonth: MonthBucket[];
}

export class ImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportValidationError";
  }
}

/* -------------------------------------------------------------------------- */
/*                          Identidade do lançamento                          */
/* -------------------------------------------------------------------------- */

/**
 * Impressão digital de um lançamento sem identificador de origem (CSV e PDF).
 *
 * Determinística de propósito: o mesmo arquivo enviado de novo — ou um extrato
 * novo cujo período se sobrepõe ao anterior — gera exatamente as mesmas chaves,
 * e a restrição única do banco descarta o repetido.
 *
 * `occurrence` distingue lançamentos legitimamente idênticos no mesmo dia (dois
 * cafés de R$ 5 no mesmo lugar). Como ele é contado na ordem do arquivo, os
 * dois entram na primeira importação e nenhum duplica na segunda.
 */
function fingerprint(entry: ParsedEntry, occurrence: number): string {
  const signature = [
    entry.date,
    entry.type,
    entry.amountCents,
    normalizeText(entry.description),
  ].join("|");

  const hash = createHash("sha1").update(signature).digest("hex").slice(0, 16);
  return `fp:${hash}:${occurrence}`;
}

function externalIdFor(entry: ParsedEntry, occurrence: number): string {
  // O prefixo evita que um FITID numérico curto colida com uma impressão
  // digital sintética.
  return entry.externalId ? `ofx:${entry.externalId}` : fingerprint(entry, occurrence);
}

/* -------------------------------------------------------------------------- */
/*                            Categorização automática                        */
/* -------------------------------------------------------------------------- */

interface CategoryRule {
  category: string;
  type: TransactionType;
  keywords: string[];
}

/**
 * Dicionário de palavras-chave por categoria.
 *
 * Vence a palavra-chave MAIS LONGA que casar, não a primeira regra da lista —
 * sem isso "mercado livre" cairia em Alimentação por causa de "mercado".
 */
const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Alimentação",
    type: "SAIDA",
    keywords: [
      "supermercado", "mercado", "padaria", "restaurante", "ifood", "rappi", "lanchonete",
      "acougue", "hortifruti", "atacadao", "assai", "carrefour", "pao de acucar", "extra",
      "sonda", "bar ", "cafe", "burger", "pizza", "ze delivery", "food", "churrascaria",
    ],
  },
  {
    category: "Transporte",
    type: "SAIDA",
    keywords: [
      "uber", "99app", "99 ", "cabify", "posto", "combustivel", "gasolina", "ipiranga",
      "shell", "petrobras", "estacionamento", "pedagio", "sem parar", "conectcar", "metro",
      "cptm", "onibus", "taxi", "bilhete unico", "localiza", "movida", "auto posto",
    ],
  },
  {
    category: "Moradia",
    type: "SAIDA",
    keywords: [
      "aluguel", "condominio", "energia", "eletrica", "enel", "sabesp", "comgas", "cemig",
      "copel", "cpfl", "eletropaulo", "iptu", "imobiliaria", "conta de luz", "conta de agua",
    ],
  },
  {
    category: "Saúde",
    type: "SAIDA",
    keywords: [
      "farmacia", "drogaria", "drogasil", "droga raia", "pacheco", "hospital", "clinica",
      "laboratorio", "unimed", "amil", "sulamerica", "dentista", "psicolog", "academia",
      "smartfit", "smart fit", "bio ritmo",
    ],
  },
  {
    category: "Educação",
    type: "SAIDA",
    keywords: [
      "escola", "faculdade", "universidade", "curso", "udemy", "alura", "coursera",
      "mensalidade", "colegio", "livraria", "kindle",
    ],
  },
  {
    category: "Lazer",
    type: "SAIDA",
    keywords: [
      "netflix", "spotify", "cinema", "disney", "hbo", "globoplay", "steam", "playstation",
      "xbox", "viagem", "hotel", "airbnb", "booking", "decolar", "latam", "gol linhas",
      "azul linhas", "ingresso", "prime video", "deezer", "twitch",
    ],
  },
  {
    category: "Serviços",
    type: "SAIDA",
    keywords: [
      "internet", "vivo", "claro", "tim ", "telefone", "celular", "assinatura", "google",
      "apple", "microsoft", "adobe", "icloud", "openai", "chatgpt", "anthropic", "telecom",
    ],
  },
  {
    category: "Compras",
    type: "SAIDA",
    keywords: [
      "mercado livre", "mercadolivre", "amazon", "shopee", "aliexpress", "magazine luiza",
      "magalu", "americanas", "casas bahia", "renner", "riachuelo", "zara", "centauro",
      "netshoes", "shopping", "leroy", "ikea",
    ],
  },
  {
    category: "Tarifas e impostos",
    type: "SAIDA",
    keywords: [
      "tarifa", "iof", "juros", "anuidade", "imposto", "darf", "ipva", "multa", "encargo",
      "cesta de servicos", "taxa de",
    ],
  },
  {
    category: "Salário",
    type: "ENTRADA",
    keywords: ["salario", "ordenado", "folha de pagamento", "remuneracao", "pro labore", "holerite", "adiantamento salarial"],
  },
  {
    category: "Rendimentos",
    type: "ENTRADA",
    keywords: ["rendimento", "dividendo", "cdb", "tesouro", "poupanca", "aplicacao", "resgate", "juros recebidos"],
  },
  {
    category: "Reembolsos",
    type: "ENTRADA",
    keywords: ["reembolso", "estorno", "devolucao", "restituicao", "cashback"],
  },
];

/**
 * Assinatura do estabelecimento: as três primeiras palavras da descrição, sem
 * acento, sem pontuação e sem números soltos (parcela, data, id de PIX). É o
 * que permite reconhecer "PAG*PADARIA DO ZE 03/12" e "PAG*PADARIA DO ZE 04/12"
 * como o mesmo lugar.
 */
function merchantSignature(description: string): string {
  return normalizeText(description)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

interface CategoryRef {
  id: string;
  name: string;
  type: TransactionType;
}

/**
 * Aprende com o histórico do próprio usuário: para cada assinatura de
 * estabelecimento, a categoria que ele mais usou. Uma escolha manual anterior
 * vale mais que o dicionário genérico.
 */
function buildHistoryMap(
  history: { description: string; type: TransactionType; categoryId: string | null }[]
): Map<string, string> {
  const tally = new Map<string, Map<string, number>>();

  for (const tx of history) {
    if (!tx.categoryId) continue;
    const signature = `${tx.type}:${merchantSignature(tx.description)}`;
    if (signature.length < 12) continue; // "SAIDA:" + 5 caracteres úteis

    const counts = tally.get(signature) ?? new Map<string, number>();
    counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
    tally.set(signature, counts);
  }

  const winners = new Map<string, string>();
  for (const [signature, counts] of tally) {
    let bestId = "";
    let bestCount = 0;
    for (const [categoryId, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestId = categoryId;
      }
    }
    if (bestId) winners.set(signature, bestId);
  }

  return winners;
}

/** Nome da categoria que o dicionário sugere, ou null. */
export function suggestCategoryName(description: string, type: TransactionType): string | null {
  const haystack = ` ${normalizeText(description)} `;
  let best: { category: string; length: number } | null = null;

  for (const rule of CATEGORY_RULES) {
    if (rule.type !== type) continue;
    for (const keyword of rule.keywords) {
      if (!haystack.includes(keyword)) continue;
      if (!best || keyword.length > best.length) {
        best = { category: rule.category, length: keyword.length };
      }
    }
  }

  return best?.category ?? null;
}

/* -------------------------------------------------------------------------- */
/*                              Montagem do lote                              */
/* -------------------------------------------------------------------------- */

function monthBuckets(candidates: ImportCandidate[]): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>();

  for (const candidate of candidates) {
    const [year, month] = candidate.date.split("-").map(Number);
    const key = `${year}-${month}`;
    const bucket = buckets.get(key) ?? {
      year,
      month,
      label: `${MONTH_NAMES[month - 1]} de ${year}`,
      count: 0,
      incomeCents: 0,
      expenseCents: 0,
    };

    bucket.count++;
    if (candidate.type === "ENTRADA") bucket.incomeCents += candidate.amountCents;
    else bucket.expenseCents += candidate.amountCents;

    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.year - b.year || a.month - b.month);
}

async function buildCandidates(
  userId: string,
  accountId: string,
  entries: ParsedEntry[]
): Promise<ImportCandidate[]> {
  // Contador por impressão digital: dois lançamentos idênticos no mesmo arquivo
  // precisam de chaves diferentes para que ambos entrem.
  const occurrences = new Map<string, number>();
  const withIds = entries.map((entry) => {
    const base = entry.externalId ? `ofx:${entry.externalId}` : fingerprint(entry, 0);
    const seen = occurrences.get(base) ?? 0;
    occurrences.set(base, seen + 1);
    return { entry, externalId: externalIdFor(entry, seen) };
  });

  const [existing, manualNearby, categories, history] = await Promise.all([
    // Já importados: casam pela chave externa na mesma conta.
    prisma.transaction.findMany({
      where: { accountId, externalId: { in: withIds.map((w) => w.externalId) } },
      select: { externalId: true },
    }),
    // Digitados à mão no mesmo período: não têm chave externa, então a única
    // defesa é avisar o usuário antes de gravar um par.
    prisma.transaction.findMany({
      where: {
        accountId,
        externalId: null,
        date: {
          gte: ledgerDayFromISO(entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date)),
          lte: ledgerDayFromISO(entries.reduce((max, e) => (e.date > max ? e.date : max), entries[0].date)),
        },
      },
      select: { date: true, amountCents: true, type: true },
    }),
    prisma.category.findMany({
      where: { userId, archived: false },
      select: { id: true, name: true, type: true },
    }),
    prisma.transaction.findMany({
      where: { userId, categoryId: { not: null } },
      select: { description: true, type: true, categoryId: true },
      orderBy: { date: "desc" },
      take: 2000,
    }),
  ]);

  const alreadyImported = new Set(existing.map((e) => e.externalId));
  const manualKeys = new Set(
    manualNearby.map((tx) => `${tx.date.toISOString().slice(0, 10)}|${tx.type}|${tx.amountCents}`)
  );

  const categoryByName = new Map<string, CategoryRef>();
  for (const category of categories) {
    categoryByName.set(`${category.type}:${normalizeText(category.name)}`, category);
  }

  const historyMap = buildHistoryMap(history);

  return withIds.map(({ entry, externalId }) => {
    let status: CandidateStatus = "NOVO";
    if (alreadyImported.has(externalId)) {
      status = "JA_IMPORTADO";
    } else if (manualKeys.has(`${entry.date}|${entry.type}|${entry.amountCents}`)) {
      status = "POSSIVEL_DUPLICADO";
    }

    // 1ª tentativa: o que o próprio usuário já escolheu para este lugar.
    const signature = `${entry.type}:${merchantSignature(entry.description)}`;
    const learnedId = historyMap.get(signature) ?? null;
    const learned = learnedId ? categories.find((c) => c.id === learnedId) : null;

    // 2ª tentativa: dicionário de palavras-chave.
    const suggestedName = learned ? null : suggestCategoryName(entry.description, entry.type);
    const existingSuggested = suggestedName
      ? (categoryByName.get(`${entry.type}:${normalizeText(suggestedName)}`) ?? null)
      : null;

    const resolved = learned ?? existingSuggested;

    return {
      externalId,
      date: entry.date,
      description: entry.description,
      amountCents: entry.amountCents,
      type: entry.type,
      status,
      categoryId: resolved?.id ?? null,
      categoryName: resolved?.name ?? null,
      // Só é "a criar" se a regra sugeriu e o usuário ainda não tem a categoria.
      suggestedCategoryName: resolved ? null : suggestedName,
    };
  });
}

function assertImportable(statement: ParsedStatement) {
  if (statement.entries.length === 0) {
    throw new ImportValidationError(
      "O arquivo foi lido, mas nenhum lançamento pôde ser aproveitado. Confira se o extrato cobre um período com movimentações."
    );
  }
  if (statement.entries.length > MAX_ENTRIES_PER_IMPORT) {
    throw new ImportValidationError(
      `O arquivo tem ${statement.entries.length} lançamentos, acima do limite de ${MAX_ENTRIES_PER_IMPORT} por importação. Exporte o extrato em períodos menores.`
    );
  }
}

async function assertOwnedAccount(userId: string, accountId: string) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true, name: true },
  });
  if (!account) throw new ImportValidationError("Conta não encontrada.");
  return account;
}

/* -------------------------------------------------------------------------- */
/*                                  Operações                                 */
/* -------------------------------------------------------------------------- */

/** Lê o extrato e diz o que aconteceria, sem gravar nada. */
export async function previewImport(
  userId: string,
  accountId: string,
  statement: ParsedStatement
): Promise<ImportPreview> {
  assertImportable(statement);
  await assertOwnedAccount(userId, accountId);

  const candidates = await buildCandidates(userId, accountId, statement.entries);
  const novos = candidates.filter((c) => c.status === "NOVO");

  const categoriesToCreate = new Map<string, { name: string; type: TransactionType }>();
  for (const candidate of candidates) {
    if (candidate.status === "JA_IMPORTADO" || !candidate.suggestedCategoryName) continue;
    categoriesToCreate.set(`${candidate.type}:${candidate.suggestedCategoryName}`, {
      name: candidate.suggestedCategoryName,
      type: candidate.type,
    });
  }

  return {
    format: statement.format,
    bankId: statement.bankId,
    statementAccountId: statement.accountId,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    candidates,
    skipped: statement.skipped,
    summary: {
      total: candidates.length,
      novos: novos.length,
      jaImportados: candidates.filter((c) => c.status === "JA_IMPORTADO").length,
      possiveisDuplicados: candidates.filter((c) => c.status === "POSSIVEL_DUPLICADO").length,
      incomeCents: novos.filter((c) => c.type === "ENTRADA").reduce((s, c) => s + c.amountCents, 0),
      expenseCents: novos.filter((c) => c.type === "SAIDA").reduce((s, c) => s + c.amountCents, 0),
      byMonth: monthBuckets(novos),
      categoriesToCreate: [...categoriesToCreate.values()],
    },
  };
}

/**
 * Grava. Reprocessa o arquivo do zero em vez de confiar numa lista vinda do
 * cliente — assim o que entra no banco é sempre o que está no extrato, e o
 * preview não vira um canal para inserir lançamento arbitrário.
 */
export async function commitImport(params: {
  userId: string;
  accountId: string;
  statement: ParsedStatement;
  includePossibleDuplicates: boolean;
  createMissingCategories: boolean;
}): Promise<ImportResult> {
  const { userId, accountId, statement, includePossibleDuplicates, createMissingCategories } = params;

  assertImportable(statement);
  await assertOwnedAccount(userId, accountId);

  let candidates = await buildCandidates(userId, accountId, statement.entries);
  let categoriesCreated = 0;

  if (createMissingCategories) {
    const pending = new Map<string, { name: string; type: TransactionType }>();
    for (const candidate of candidates) {
      if (candidate.status === "JA_IMPORTADO" || !candidate.suggestedCategoryName) continue;
      pending.set(`${candidate.type}:${candidate.suggestedCategoryName}`, {
        name: candidate.suggestedCategoryName,
        type: candidate.type,
      });
    }

    if (pending.size > 0) {
      const palette = categoryPalette.light;
      const existingCount = await prisma.category.count({ where: { userId } });

      const created = await prisma.category.createMany({
        data: [...pending.values()].map((category, index) => ({
          userId,
          name: category.name,
          type: category.type,
          color: palette[(existingCount + index) % palette.length],
        })),
        // A categoria pode ter sido criada por outra importação em paralelo; a
        // restrição única do banco resolve sem derrubar o lote.
        skipDuplicates: true,
      });
      categoriesCreated = created.count;

      // As categorias novas só existem agora, então a resolução tem que rodar
      // de novo para que os lançamentos deste lote já nasçam categorizados.
      candidates = await buildCandidates(userId, accountId, statement.entries);
    }
  }

  const toImport = candidates.filter(
    (c) => c.status === "NOVO" || (includePossibleDuplicates && c.status === "POSSIVEL_DUPLICADO")
  );

  if (toImport.length === 0) {
    return { imported: 0, skippedExisting: candidates.length, categoriesCreated, byMonth: [] };
  }

  const importedAt = new Date();
  const result = await prisma.transaction.createMany({
    data: toImport.map((candidate) => ({
      userId,
      accountId,
      categoryId: candidate.categoryId,
      // Mesmo helper do formulário manual: é o que faz o lançamento cair no mês
      // que o extrato diz, e não no mês do fuso do servidor.
      date: ledgerDayFromISO(candidate.date),
      description: candidate.description,
      amountCents: candidate.amountCents,
      type: candidate.type,
      externalId: candidate.externalId,
      importedAt,
    })),
    // Rede de segurança para envios simultâneos do mesmo arquivo.
    skipDuplicates: true,
  });

  return {
    imported: result.count,
    skippedExisting: candidates.length - toImport.length,
    categoriesCreated,
    byMonth: monthBuckets(toImport),
  };
}
