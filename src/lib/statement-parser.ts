/**
 * Leitura de extrato bancário: OFX (v1 SGML e v2 XML) e CSV.
 *
 * Este módulo é PURO — não toca no banco, não conhece usuário e não decide o
 * que fazer com o que leu. Ele recebe bytes e devolve lançamentos normalizados.
 * Toda a regra de duplicidade, categorização e gravação vive em
 * `import-service.ts`. Manter a separação é o que permite testar o parser com
 * um arquivo de exemplo sem subir banco.
 */

export type StatementFormat = "OFX" | "CSV";

export interface ParsedEntry {
  /**
   * Id do lançamento no banco de origem (FITID do OFX). Nulo em CSV, que não
   * carrega identificador — nesse caso o `import-service` sintetiza um.
   */
  externalId: string | null;
  /** Dia do lançamento em `yyyy-MM-dd`, já sem hora e sem fuso. */
  date: string;
  description: string;
  /** Sempre positivo. O sinal virou `type`, como no resto do razão. */
  amountCents: number;
  type: "ENTRADA" | "SAIDA";
}

export interface SkippedRow {
  line: number;
  reason: string;
  raw: string;
}

export interface ParsedStatement {
  format: StatementFormat;
  entries: ParsedEntry[];
  /** Linhas que o parser entendeu como lançamento mas não conseguiu ler. */
  skipped: SkippedRow[];
  /** Metadados do extrato, quando o formato os traz. Só informativos. */
  bankId: string | null;
  accountId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export class StatementParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatementParseError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Codificação                                */
/* -------------------------------------------------------------------------- */

/**
 * OFX de banco brasileiro raramente é UTF-8: o cabeçalho costuma declarar
 * `CHARSET:1252`. Decodificar como UTF-8 nesse caso destrói os acentos, e a
 * descrição é justamente o que alimenta a categorização automática.
 */
export function decodeStatementBytes(bytes: Uint8Array): string {
  // O cabeçalho do OFX é ASCII puro, então latin1 sempre lê os primeiros bytes
  // corretamente — inclusive num arquivo UTF-8.
  const header = new TextDecoder("latin1").decode(bytes.slice(0, 512)).toUpperCase();

  const declaresWindows1252 =
    header.includes("CHARSET:1252") ||
    header.includes("CHARSET:ISO-8859-1") ||
    header.includes("CHARSET=\"1252\"");
  const declaresUtf8 = header.includes("UTF-8") || header.includes("CHARSET:UTF8");

  if (declaresWindows1252 && !declaresUtf8) {
    return new TextDecoder("windows-1252").decode(bytes);
  }

  // Sem declaração confiável: tenta UTF-8 em modo estrito. Se os bytes não
  // formarem UTF-8 válido, o arquivo é latin1/1252 — não existe terceira opção
  // comum em extrato bancário.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/* -------------------------------------------------------------------------- */
/*                              Valores e datas                               */
/* -------------------------------------------------------------------------- */

/**
 * Converte um valor monetário com sinal para centavos.
 *
 * Precisa aguentar as três convenções que aparecem na prática: `-1234.56` (OFX
 * conforme a spec), `-1.234,56` (banco brasileiro que ignora a spec) e
 * `(1.234,56)` (CSV de planilha, negativo entre parênteses).
 *
 * `parseAmountToCents` de `ledger-calc` não serve aqui porque ela rejeita
 * negativos de propósito — o formulário manual nunca recebe sinal.
 */
export function parseSignedAmountToCents(
  input: string
): { cents: number; negative: boolean } | null {
  let raw = input.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!raw) return null;

  const parenthesized = /^\(.*\)$/.test(raw);
  const negative = parenthesized || raw.includes("-");
  raw = raw.replace(/[()+\-]/g, "");
  if (!/\d/.test(raw)) return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized: string;

  if (lastComma >= 0 && lastDot >= 0) {
    // Os dois presentes: o que vem por último é o separador decimal.
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = raw.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    // Só vírgula. Com 1 ou 2 dígitos depois é decimal; com 3 é separador de
    // milhar ("1,234" é mil duzentos e trinta e quatro, não 1 real e 23).
    normalized = /,\d{1,2}$/.test(raw) ? raw.replace(",", ".") : raw.split(",").join("");
  } else if (lastDot >= 0) {
    normalized = /\.\d{1,2}$/.test(raw) ? raw : raw.split(".").join("");
  } else {
    normalized = raw;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return { cents: Math.round(Math.abs(value) * 100), negative };
}

/**
 * `DTPOSTED` do OFX: `YYYYMMDD`, opcionalmente seguido de hora e de um fuso
 * entre colchetes (`20260815120000[-03:BRT]`).
 *
 * Fico com os 8 primeiros dígitos e descarto hora e fuso de propósito. O que o
 * banco está afirmando é o DIA em que o lançamento foi postado; converter esse
 * carimbo entre fusos é o caminho mais curto para um gasto do dia 1º cair no
 * mês anterior — exatamente o bug de fuso que o razão já resolveu em
 * `ledgerDayFromISO`.
 */
export function parseOfxDate(value: string): string | null {
  const digits = value.trim().replace(/^\[/, "");
  const match = digits.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  return buildDate(Number(year), Number(month), Number(day));
}

/** Datas de CSV: `dd/MM/yyyy`, `dd-MM-yyyy`, `yyyy-MM-dd`, `dd/MM/yy`. */
export function parseCsvDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return buildDate(Number(y), Number(m), Number(d));
  }

  const br = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (br) {
    const [, d, m, y] = br;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return buildDate(year, Number(m), Number(d));
  }

  // Alguns exports trazem o compacto do OFX mesmo em CSV.
  return parseOfxDate(raw);
}

function buildDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2200) return null;

  // Rejeita 31/02 e afins: `Date.UTC` normalizaria para março em silêncio, e um
  // lançamento cairia no mês errado sem ninguém perceber.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Remove acento e caixa. Base de toda comparação de texto deste módulo. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cleanDescription(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

/* -------------------------------------------------------------------------- */
/*                                    OFX                                     */
/* -------------------------------------------------------------------------- */

/**
 * Lê o valor de uma tag OFX. O mesmo padrão serve para as duas versões: em v1
 * (SGML, sem tag de fechamento) o valor termina na quebra de linha, e em v2
 * (XML) termina em `</TAG>` — parar em `<` ou em quebra de linha cobre as duas.
 */
function ofxField(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, "i"));
  if (!match) return null;
  const value = match[1].trim();
  return value || null;
}

export function parseOfx(content: string): ParsedStatement {
  const entries: ParsedEntry[] = [];
  const skipped: SkippedRow[] = [];

  // Fecha o bloco no `</STMTTRN>` (v2), no início do próximo lançamento (v1) ou
  // no fim do arquivo — nessa ordem.
  const blockPattern = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;
  const blocks = [...content.matchAll(blockPattern)];

  if (blocks.length === 0) {
    throw new StatementParseError(
      "Nenhum lançamento encontrado no arquivo OFX. Confira se o extrato exportado cobre um período com movimentações."
    );
  }

  blocks.forEach((match, index) => {
    const block = match[1];
    const rawDate = ofxField(block, "DTPOSTED") ?? ofxField(block, "DTAVAIL");
    const rawAmount = ofxField(block, "TRNAMT");

    const date = rawDate ? parseOfxDate(rawDate) : null;
    if (!date) {
      skipped.push({
        line: index + 1,
        reason: "data ausente ou ilegível",
        raw: block.trim().slice(0, 120),
      });
      return;
    }

    const amount = rawAmount ? parseSignedAmountToCents(rawAmount) : null;
    if (!amount || amount.cents === 0) {
      skipped.push({
        line: index + 1,
        reason: "valor ausente, zerado ou ilegível",
        raw: block.trim().slice(0, 120),
      });
      return;
    }

    // Banco brasileiro põe o histórico no MEMO; NAME costuma vir vazio ou com
    // um rótulo genérico. Por isso MEMO tem prioridade.
    const memo = ofxField(block, "MEMO");
    const name = ofxField(block, "NAME");
    const trnType = ofxField(block, "TRNTYPE");
    const description = cleanDescription(memo || name || trnType || "Lançamento importado");

    entries.push({
      externalId: ofxField(block, "FITID"),
      date,
      description,
      amountCents: amount.cents,
      // O sinal do TRNAMT é a fonte da verdade, não o TRNTYPE: os rótulos de
      // TRNTYPE variam muito entre bancos, o sinal não.
      type: amount.negative ? "SAIDA" : "ENTRADA",
    });
  });

  const periodStart = ofxField(content, "DTSTART");
  const periodEnd = ofxField(content, "DTEND");

  return {
    format: "OFX",
    entries,
    skipped,
    bankId: ofxField(content, "BANKID"),
    accountId: ofxField(content, "ACCTID"),
    periodStart: periodStart ? parseOfxDate(periodStart) : null,
    periodEnd: periodEnd ? parseOfxDate(periodEnd) : null,
  };
}

/* -------------------------------------------------------------------------- */
/*                                    CSV                                     */
/* -------------------------------------------------------------------------- */

/** Cabeçalhos que cada banco usa para a mesma coisa, já sem acento. */
const CSV_HEADERS = {
  date: [
    "data",
    "date",
    "data lancamento",
    "data do lancamento",
    "data movimento",
    "data da compra",
    "data compra",
    "dt",
  ],
  description: [
    "descricao",
    "description",
    "title",
    "titulo",
    "historico",
    "lancamento",
    "memo",
    "detalhe",
    "detalhes",
    "estabelecimento",
    "movimentacao",
    "operacao",
  ],
  amount: ["valor", "amount", "value", "quantia", "montante"],
  credit: ["credito", "entrada", "receita", "deposito"],
  debit: ["debito", "saida", "despesa", "saque"],
  externalId: ["identificador", "fitid", "id transacao", "id"],
} as const;

function matchHeader(header: string, candidates: readonly string[]): boolean {
  const normalized = normalizeText(header).replace(/["']/g, "");
  return candidates.some((c) => normalized === c || normalized.startsWith(c));
}

/** Divide uma linha de CSV respeitando aspas e aspas escapadas (duplicadas). */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);

  return fields.map((f) => f.trim().replace(/^"|"$/g, "").trim());
}

/**
 * O separador varia com a região do Excel que gerou o arquivo: `;` no Brasil,
 * `,` nos exports de app. Escolho o que produz mais colunas na linha analisada.
 */
function detectDelimiter(line: string): string {
  const candidates = [";", ",", "\t", "|"];
  let best = ",";
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = splitCsvLine(line, candidate).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }

  return best;
}

export function parseCsv(content: string): ParsedStatement {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new StatementParseError("O arquivo CSV está vazio ou tem apenas o cabeçalho.");
  }

  // Alguns bancos jogam um preâmbulo antes da tabela ("Extrato da conta ..."),
  // então o cabeçalho de verdade é a primeira linha que traz data E valor.
  let headerIndex = -1;
  let headers: string[] = [];
  let delimiter = ",";

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const candidateDelimiter = detectDelimiter(lines[i]);
    const candidate = splitCsvLine(lines[i], candidateDelimiter);
    const hasDate = candidate.some((h) => matchHeader(h, CSV_HEADERS.date));
    const hasValue = candidate.some(
      (h) =>
        matchHeader(h, CSV_HEADERS.amount) ||
        matchHeader(h, CSV_HEADERS.credit) ||
        matchHeader(h, CSV_HEADERS.debit)
    );

    if (hasDate && hasValue) {
      headerIndex = i;
      headers = candidate;
      delimiter = candidateDelimiter;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new StatementParseError(
      "Não encontrei as colunas de data e valor no CSV. O arquivo precisa ter um cabeçalho com algo como Data e Valor."
    );
  }

  const columnOf = (candidates: readonly string[]) =>
    headers.findIndex((h) => matchHeader(h, candidates));

  const dateCol = columnOf(CSV_HEADERS.date);
  const descriptionCol = columnOf(CSV_HEADERS.description);
  const amountCol = columnOf(CSV_HEADERS.amount);
  const creditCol = columnOf(CSV_HEADERS.credit);
  const debitCol = columnOf(CSV_HEADERS.debit);
  const externalIdCol = columnOf(CSV_HEADERS.externalId);

  if (amountCol === -1 && creditCol === -1 && debitCol === -1) {
    throw new StatementParseError("O CSV não tem coluna de valor reconhecível.");
  }

  const entries: ParsedEntry[] = [];
  const skipped: SkippedRow[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    const fields = splitCsvLine(raw, delimiter);
    const lineNumber = i + 1;

    const date = dateCol >= 0 ? parseCsvDate(fields[dateCol] ?? "") : null;
    if (!date) {
      skipped.push({ line: lineNumber, reason: "data ausente ou ilegível", raw: raw.slice(0, 120) });
      continue;
    }

    // Duas convenções coexistem: uma coluna de valor com sinal, ou colunas
    // separadas de crédito e débito.
    let cents: number | null = null;
    let negative = false;

    if (amountCol >= 0 && fields[amountCol]) {
      const parsed = parseSignedAmountToCents(fields[amountCol]);
      if (parsed) {
        cents = parsed.cents;
        negative = parsed.negative;
      }
    }

    if (cents === null && creditCol >= 0 && fields[creditCol]) {
      const parsed = parseSignedAmountToCents(fields[creditCol]);
      if (parsed && parsed.cents > 0) {
        cents = parsed.cents;
        negative = false;
      }
    }

    if (cents === null && debitCol >= 0 && fields[debitCol]) {
      const parsed = parseSignedAmountToCents(fields[debitCol]);
      if (parsed && parsed.cents > 0) {
        cents = parsed.cents;
        negative = true;
      }
    }

    if (cents === null || cents === 0) {
      skipped.push({
        line: lineNumber,
        reason: "valor ausente, zerado ou ilegível",
        raw: raw.slice(0, 120),
      });
      continue;
    }

    const description = cleanDescription(
      (descriptionCol >= 0 ? fields[descriptionCol] : "") || "Lançamento importado"
    );

    entries.push({
      externalId: externalIdCol >= 0 ? fields[externalIdCol] || null : null,
      date,
      description,
      amountCents: cents,
      type: negative ? "SAIDA" : "ENTRADA",
    });
  }

  const dates = entries.map((e) => e.date).sort();

  return {
    format: "CSV",
    entries,
    skipped,
    bankId: null,
    accountId: null,
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null,
  };
}

/* -------------------------------------------------------------------------- */

/**
 * Porta de entrada: decide o formato pelo CONTEÚDO, não pela extensão — extrato
 * baixado do banco chega como `.txt` com frequência suficiente para a extensão
 * não ser confiável.
 */
export function parseStatement(content: string): ParsedStatement {
  const head = content.slice(0, 2048).toUpperCase();
  const looksLikeOfx =
    head.includes("<OFX") || head.includes("OFXHEADER") || head.includes("<STMTTRN>");

  return looksLikeOfx ? parseOfx(content) : parseCsv(content);
}
