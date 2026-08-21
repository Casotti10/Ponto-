import {
  normalizeText,
  parseSignedAmountToCents,
  StatementParseError,
  type ParsedEntry,
  type ParsedStatement,
  type SkippedRow,
} from "@/lib/statement-parser";

/**
 * Leitura de extrato e fatura em PDF.
 *
 * PDF é o pior formato possível para isto e só existe aqui porque vários bancos
 * não oferecem OFX da fatura do cartão. Um PDF não tem estrutura de dados: tem
 * texto posicionado numa página. Extrair lançamento dele é reconhecer padrão de
 * layout, e layout muda sem aviso. Sempre que o banco oferecer OFX, use OFX —
 * lá o lançamento vem com identificador próprio e a importação é exata.
 *
 * Dois layouts são reconhecidos:
 *   - Extrato de conta do Nubank (calibrado sobre um arquivo real)
 *   - Fatura de cartão no formato `DD/MM DESCRIÇÃO VALOR`, que é o mais comum
 *     entre os bancos brasileiros (Santander, Itaú, Bradesco, BB)
 *
 * ATENÇÃO: o layout de extrato do Nubank foi verificado contra um arquivo real
 * (os totais batem ao centavo com o que o próprio banco declara). O layout de
 * fatura NÃO foi — o arquivo que motivou este caminho é protegido por senha e
 * não pôde ser aberto durante o desenvolvimento. Trate-o como não calibrado até
 * a primeira importação real confirmar.
 */

export class PdfPasswordError extends Error {
  /** `true` quando o arquivo é protegido e nenhuma senha foi informada. */
  readonly missing: boolean;

  constructor(missing: boolean) {
    super(
      missing
        ? "Este PDF é protegido por senha. Bancos costumam usar dígitos do CPF ou a data de nascimento."
        : "Senha incorreta para este PDF."
    );
    this.name = "PdfPasswordError";
    this.missing = missing;
  }
}

/* -------------------------------------------------------------------------- */
/*                             Extração do texto                              */
/* -------------------------------------------------------------------------- */

/** Assinatura `%PDF` no começo do arquivo. */
export function isPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

export async function extractPdfText(bytes: Uint8Array, password?: string): Promise<string> {
  // Import dinâmico: o pdf.js é pesado e só precisa ser carregado quando um PDF
  // realmente chega. Extrato OFX/CSV não paga esse custo.
  const { extractText, getDocumentProxy } = await import("unpdf");

  let pdf;
  try {
    pdf = await getDocumentProxy(bytes, password ? { password } : undefined);
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "PasswordException") {
      // code 1 = senha ausente, 2 = senha errada (convenção do pdf.js).
      const code = (error as { code?: number })?.code;
      throw new PdfPasswordError(code !== 2);
    }
    throw new StatementParseError(
      "Não foi possível abrir o PDF. Confira se o arquivo não está corrompido."
    );
  }

  const { text } = await extractText(pdf, { mergePages: true });
  if (!text || text.trim().length < 50) {
    throw new StatementParseError(
      "O PDF não tem texto legível — provavelmente é uma imagem digitalizada. Exporte o extrato em OFX, CSV, ou um PDF gerado pelo banco."
    );
  }

  return text;
}

/* -------------------------------------------------------------------------- */
/*                               Utilidades                                   */
/* -------------------------------------------------------------------------- */

const MONTH_ABBR: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

/**
 * Valor no fim da linha, no formato brasileiro (`1.234,56`).
 *
 * O sufixo é tão importante quanto o número: documento bancário brasileiro
 * marca o sinal DEPOIS do valor com `-`, `CR` (crédito), `C` ou `D` (débito).
 * Sem aceitar esse sufixo, "1.234,56-" simplesmente não casa e a linha inteira
 * é descartada em silêncio — foi o que acontecia com os pagamentos da fatura.
 */
const TRAILING_AMOUNT = /(-?\s*R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2})\s*(CR|C|D|-)?\s*$/i;

/** Sufixos que indicam crédito (abatem a fatura em vez de aumentá-la). */
function suffixMeansCredit(suffix: string | undefined): boolean {
  return /^(CR|C|-)$/i.test((suffix ?? "").trim());
}

function isoDay(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

/* -------------------------------------------------------------------------- */
/*                       Layout 1 — extrato Nubank                            */
/* -------------------------------------------------------------------------- */

/** Rodapé e cabeçalho que se repetem em toda página e não são lançamento. */
const NU_FURNITURE = [
  /^Tem alguma d[úu]vida\?/i,
  /^metropolitanas\)/i,
  /^Caso a solu[çc][ãa]o/i,
  /^dispon[íi]veis em nubank/i,
  /^Extrato gerado dia/i,
  /CPF\s+Ag[êe]ncia\s+Conta/i,
  /VALORES EM R\$/i,
  /^Movimenta[çc][õo]es$/i,
  /^Saldo (inicial|final)/i,
  /^Rendimento l[íi]quido/i,
  /^•+\./,
];

const NU_DAY_HEADER = /^(\d{2})\s+([A-Za-zÇç]{3})\s+(\d{4})\b(.*)$/;
const NU_SECTION = /^Total de (entradas|sa[íi]das)\b/i;

function looksLikeNubankStatement(text: string): boolean {
  const normalized = normalizeText(text);
  return (
    normalized.includes("movimentacoes") &&
    normalized.includes("total de entradas") &&
    normalized.includes("total de saidas")
  );
}

function parseNubankStatement(rawLines: string[]): { entries: ParsedEntry[]; skipped: SkippedRow[] } {
  // O nome do titular e o número da conta aparecem soltos no topo de cada
  // página. Como os dois também aparecem DENTRO de descrições de transferência,
  // só descarto a linha quando ela é exatamente igual ao valor do cabeçalho.
  const holderName = rawLines.find((l) => l.trim().length > 0)?.trim() ?? "";
  const headerIndex = rawLines.findIndex((l) => /CPF\s+Ag[êe]ncia\s+Conta/i.test(l));
  const accountLine = headerIndex >= 0 ? (rawLines[headerIndex + 1]?.trim() ?? "") : "";

  const lines = rawLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => l !== holderName && (accountLine === "" || l !== accountLine))
    .filter((l) => !NU_FURNITURE.some((pattern) => pattern.test(l)))
    // A linha de período começa com "a01 DE JULHO DE 2026 ..." — o "a" grudado
    // é do próprio PDF.
    .filter((l) => !/^a?\d{2} DE [A-ZÇ]+ DE \d{4}/i.test(l));

  const entries: ParsedEntry[] = [];
  const skipped: SkippedRow[] = [];

  let currentDate: string | null = null;
  let currentType: "ENTRADA" | "SAIDA" | null = null;
  let buffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const dayMatch = line.match(NU_DAY_HEADER);
    if (dayMatch) {
      const [, day, monthAbbr, year, rest] = dayMatch;
      const month = MONTH_ABBR[normalizeText(monthAbbr)];
      const iso = month ? isoDay(Number(year), month, Number(day)) : null;
      if (iso) {
        currentDate = iso;
        buffer = [];
        // A mesma linha costuma trazer a seção: "05 JUL 2026 Total de entradas +X".
        // O `trim` é essencial: `rest` vem com o espaço que separava a data, e
        // `NU_SECTION` é ancorada em `^` — sem isso a seção nunca casa aqui e o
        // tipo fica preso no da seção anterior, marcando entrada como saída.
        const section = rest.trim().match(NU_SECTION);
        if (section) currentType = /entrada/i.test(section[1]) ? "ENTRADA" : "SAIDA";
        continue;
      }
    }

    if (NU_SECTION.test(line)) {
      currentType = /entrada/i.test(line) ? "ENTRADA" : "SAIDA";
      buffer = [];
      continue;
    }

    // Antes do primeiro dia é o resumo do período (saldo inicial, totais). Nada
    // ali é lançamento.
    if (!currentDate || !currentType) continue;

    const amountMatch = line.match(TRAILING_AMOUNT);
    if (!amountMatch) {
      // Descrição longa quebrada em várias linhas: guarda e segue.
      buffer.push(line);
      continue;
    }

    const parsed = parseSignedAmountToCents(amountMatch[1]);
    if (!parsed || parsed.cents === 0) {
      buffer.push(line);
      continue;
    }

    const inline = line.slice(0, amountMatch.index).trim();
    const description = clean([...buffer, inline].join(" ")) || "Lançamento importado";
    buffer = [];

    entries.push({
      externalId: null,
      date: currentDate,
      description,
      amountCents: parsed.cents,
      // O sinal vem da SEÇÃO ("Total de entradas" / "Total de saídas"), porque
      // no extrato do Nubank o valor da linha vem sempre sem sinal.
      type: currentType,
    });
  }

  return { entries, skipped };
}

/* -------------------------------------------------------------------------- */
/*                     Layout 2 — fatura de cartão (genérico)                 */
/* -------------------------------------------------------------------------- */

/** `12/08 SUPERMERCADO XYZ 145,90` — o formato mais comum de fatura. */
const FATURA_LINE = /^(\d{2})[/.](\d{2})(?:[/.](\d{2,4}))?\s+(.+)$/;

/** `12 AGO SUPERMERCADO XYZ 145,90` — variante com mês por extenso. */
const FATURA_LINE_ABBR = /^(\d{2})\s+([A-Za-zÇç]{3})\s+(.+)$/;

/**
 * Linhas que têm data e valor mas não são compra: totais, limites e resumos.
 * Sem isto o "Total desta fatura" entraria como se fosse um gasto.
 */
const FATURA_NOISE = [
  "total desta fatura", "total da fatura", "saldo anterior", "saldo em",
  "pagamento minimo", "pagamento mínimo", "limite", "credito rotativo",
  "encargos do proximo", "valor total", "vencimento", "fechamento",
  "resumo da fatura", "total a pagar", "juros de mora", "multa de",
  "lancamentos do periodo", "demonstrativo",
];

/** Lançamentos de crédito na fatura: abatem a dívida em vez de aumentá-la. */
const FATURA_CREDITS = [
  "pagamento efetuado", "pagamento recebido", "pgto debito automatico",
  "pagamento em", "estorno", "credito de", "devolucao", "cashback", "desconto",
];

function looksLikeFatura(text: string): boolean {
  const normalized = normalizeText(text);
  return (
    normalized.includes("fatura") ||
    normalized.includes("cartao de credito") ||
    (normalized.includes("vencimento") && normalized.includes("limite"))
  );
}

/**
 * Fatura mostra a compra como `DD/MM`, sem ano. O ano sai do período de
 * referência: numa fatura de janeiro, uma compra de 15/12 é do ano anterior.
 */
function inferYear(month: number, referenceMonth: number, referenceYear: number): number {
  return month > referenceMonth ? referenceYear - 1 : referenceYear;
}

function findFaturaReference(
  text: string,
  filename?: string
): { month: number; year: number } | null {
  const normalized = normalizeText(text);

  // "vencimento 10/09/2026" é o marcador mais confiável do período.
  const dueDate = normalized.match(/vencimento[^0-9]{0,20}(\d{2})\/(\d{2})\/(\d{4})/);
  if (dueDate) return { month: Number(dueDate[2]), year: Number(dueDate[3]) };

  const monthYear = normalized.match(/fatura[^0-9]{0,20}(\d{2})\/(\d{4})/);
  if (monthYear) return { month: Number(monthYear[1]), year: Number(monthYear[2]) };

  // Último recurso: o nome do arquivo. Os bancos carimbam o período ali
  // ("Fatura_082026_...", "fatura-2026-08.pdf"), e essa costuma ser a única
  // pista quando o texto extraído não traz o vencimento num formato legível.
  if (filename) {
    const compact = filename.match(/(?:^|[^0-9])(0[1-9]|1[0-2])(20\d{2})(?:[^0-9]|$)/);
    if (compact) return { month: Number(compact[1]), year: Number(compact[2]) };

    const dashed = filename.match(/(20\d{2})[-_.](0[1-9]|1[0-2])(?:[^0-9]|$)/);
    if (dashed) return { month: Number(dashed[2]), year: Number(dashed[1]) };
  }

  return null;
}

function parseFatura(
  rawLines: string[],
  text: string,
  filename?: string
): { entries: ParsedEntry[]; skipped: SkippedRow[] } {
  const reference = findFaturaReference(text, filename);
  if (!reference) {
    throw new StatementParseError(
      "Não consegui identificar o mês de referência da fatura. Sem ele não dá para saber o ano de cada compra — prefira exportar a fatura em OFX ou CSV."
    );
  }

  const entries: ParsedEntry[] = [];
  const skipped: SkippedRow[] = [];

  rawLines.forEach((raw, index) => {
    const line = raw.trim();
    if (line.length < 8) return;

    const normalized = normalizeText(line);
    if (FATURA_NOISE.some((noise) => normalized.includes(noise))) return;

    let day: number | null = null;
    let month: number | null = null;
    let rest: string | null = null;

    const slash = line.match(FATURA_LINE);
    if (slash) {
      day = Number(slash[1]);
      month = Number(slash[2]);
      rest = slash[4];
    } else {
      const abbr = line.match(FATURA_LINE_ABBR);
      if (abbr) {
        day = Number(abbr[1]);
        month = MONTH_ABBR[normalizeText(abbr[2])] ?? null;
        rest = abbr[3];
      }
    }

    if (day === null || month === null || !rest) return;

    const amountMatch = rest.match(TRAILING_AMOUNT);
    if (!amountMatch) return;

    const parsed = parseSignedAmountToCents(amountMatch[1]);
    if (!parsed || parsed.cents === 0) {
      skipped.push({ line: index + 1, reason: "valor ilegível", raw: line.slice(0, 120) });
      return;
    }

    const date = isoDay(inferYear(month, reference.month, reference.year), month, day);
    if (!date) {
      skipped.push({ line: index + 1, reason: "data inválida", raw: line.slice(0, 120) });
      return;
    }

    const description = clean(rest.slice(0, amountMatch.index)) || "Compra no cartão";

    // Numa fatura tudo é gasto por padrão. Crédito é a exceção: valor negativo,
    // sufixo CR, ou uma descrição de pagamento/estorno.
    const descriptionNormalized = normalizeText(description);
    const isCredit =
      parsed.negative ||
      suffixMeansCredit(amountMatch[2]) ||
      FATURA_CREDITS.some((keyword) => descriptionNormalized.includes(keyword));

    entries.push({
      externalId: null,
      date,
      description,
      amountCents: parsed.cents,
      type: isCredit ? "ENTRADA" : "SAIDA",
    });
  });

  return { entries, skipped };
}

/* -------------------------------------------------------------------------- */

export function parsePdfStatement(text: string, filename?: string): ParsedStatement {
  const rawLines = text.split(/\r?\n/);

  const { entries, skipped } = looksLikeNubankStatement(text)
    ? parseNubankStatement(rawLines)
    : looksLikeFatura(text)
      ? parseFatura(rawLines, text, filename)
      : (() => {
          throw new StatementParseError(
            "Não reconheci o layout deste PDF. Os formatos lidos são o extrato de conta do Nubank e a fatura de cartão no padrão DD/MM. Para qualquer outro banco, exporte em OFX ou CSV."
          );
        })();

  if (entries.length === 0) {
    throw new StatementParseError(
      "O PDF foi lido, mas nenhum lançamento pôde ser extraído. PDF é um formato frágil para isto — se o banco oferecer OFX ou CSV, prefira."
    );
  }

  const dates = entries.map((e) => e.date).sort();

  return {
    format: "PDF",
    entries,
    skipped,
    bankId: null,
    accountId: null,
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null,
  };
}
