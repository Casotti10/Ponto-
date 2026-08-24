import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { ImportForbiddenError, requireImportAccess } from "@/lib/import-access";
import {
  commitImport,
  ImportValidationError,
  previewImport,
  MAX_ENTRIES_PER_IMPORT,
  type ImportOverrides,
  type SignMode,
} from "@/lib/import-service";
import { decodeStatementBytes, parseStatement, StatementParseError } from "@/lib/statement-parser";
import {
  extractPdfText,
  isPdf,
  parsePdfStatement,
  PdfPasswordError,
} from "@/lib/pdf-statement-parser";

/**
 * POST /api/financeiro/import
 *
 * Importa um extrato bancário (OFX ou CSV) para uma conta do razão.
 *
 * Acesso restrito pela allowlist de `import-access.ts` — é a resposta ao
 * requisito de o recurso valer só para o login do dono do projeto.
 *
 * Dois modos, no campo `mode`:
 *   - `preview` (padrão): lê o arquivo e responde o que ACONTECERIA. Não grava.
 *   - `commit`: grava de fato.
 *
 * O cliente envia o mesmo arquivo nas duas chamadas. É deliberado: o commit
 * reprocessa o extrato do zero em vez de aceitar uma lista de lançamentos vinda
 * do navegador, então o que entra no banco é sempre o que está no arquivo.
 *
 * Corpo: multipart/form-data
 *   file                      (obrigatório) .ofx | .csv | .txt | .pdf
 *   accountId                 (obrigatório) conta de destino
 *   mode                      preview | commit
 *   includePossibleDuplicates true para gravar também o que casa com lançamento
 *                             digitado à mão no mesmo dia/valor
 *   createMissingCategories   true (padrão) para criar as categorias que a
 *                             classificação automática sugerir
 *   password                  senha do PDF, quando o banco protege o arquivo.
 *                             Usada só para abrir o documento e nunca gravada.
 *   signMode                  auto (padrão) | expense | income | invert — como
 *                             interpretar o sinal dos valores do arquivo
 *   overrides                 JSON { [externalId]: { type?, categoryId? } } com
 *                             as correções feitas na tela de conferência
 *
 * Exemplo:
 *   curl -X POST https://<app>/api/financeiro/import \
 *     -H "Cookie: ponto_session=<token>" \
 *     -F "file=@extrato.ofx" \
 *     -F "accountId=<id>" \
 *     -F "mode=preview"
 */

/** 5 MB. Extrato OFX de um ano fica na casa das centenas de KB. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function boolField(value: FormDataEntryValue | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on";
}

const SIGN_MODES: SignMode[] = ["auto", "expense", "income", "invert"];

function signModeField(value: FormDataEntryValue | null): SignMode {
  const normalized = String(value ?? "auto").trim().toLowerCase() as SignMode;
  return SIGN_MODES.includes(normalized) ? normalized : "auto";
}

/**
 * Correções por linha, em JSON.
 *
 * Filtra campo por campo em vez de confiar no formato recebido: o corpo vem do
 * navegador, e só `type` e `categoryId` podem passar. Valor, data e descrição
 * continuam saindo exclusivamente do arquivo, então nem um corpo forjado
 * consegue gravar um lançamento que não está no extrato.
 */
function overridesField(value: FormDataEntryValue | null): ImportOverrides {
  if (!value) return {};

  let raw: unknown;
  try {
    raw = JSON.parse(String(value));
  } catch {
    return {};
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: ImportOverrides = {};
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>).slice(
    0,
    MAX_ENTRIES_PER_IMPORT
  )) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const candidate = entry as { type?: unknown; categoryId?: unknown };
    const override: { type?: "ENTRADA" | "SAIDA"; categoryId?: string | null } = {};

    if (candidate.type === "ENTRADA" || candidate.type === "SAIDA") {
      override.type = candidate.type;
    }
    if (candidate.categoryId === null || typeof candidate.categoryId === "string") {
      override.categoryId = candidate.categoryId || null;
    }

    if (Object.keys(override).length > 0) result[key] = override;
  }

  return result;
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireImportAccess();
  } catch (error) {
    if (error instanceof ImportForbiddenError) {
      return NextResponse.json(
        { error: "Importação de extrato não está habilitada para esta conta." },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Envie o arquivo como multipart/form-data." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `Arquivo acima de ${MAX_FILE_BYTES / 1024 / 1024} MB. Exporte o extrato em períodos menores.` },
      { status: 413 }
    );
  }

  const accountId = String(form.get("accountId") ?? "").trim();
  if (!accountId) {
    return NextResponse.json({ error: "Selecione a conta de destino." }, { status: 400 });
  }

  // Só existe durante esta requisição: nunca é persistida nem registrada em log.
  const password = String(form.get("password") ?? "").trim();

  const signMode = signModeField(form.get("signMode"));
  const overrides = overridesField(form.get("overrides"));

  const mode = String(form.get("mode") ?? "preview").toLowerCase();
  if (mode !== "preview" && mode !== "commit") {
    return NextResponse.json({ error: "mode deve ser preview ou commit." }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());

    // PDF segue outro caminho: precisa de extração de texto (assíncrona, e com
    // senha quando o banco protege o arquivo) antes de virar lançamento.
    const statement = isPdf(bytes)
      ? parsePdfStatement(await extractPdfText(bytes, password || undefined), file.name)
      : parseStatement(decodeStatementBytes(bytes));

    if (mode === "preview") {
      const preview = await previewImport(user.id, accountId, statement, signMode, overrides);
      return NextResponse.json(preview);
    }

    const result = await commitImport({
      userId: user.id,
      accountId,
      statement,
      includePossibleDuplicates: boolField(form.get("includePossibleDuplicates"), false),
      createMissingCategories: boolField(form.get("createMissingCategories"), true),
      signMode,
      overrides,
    });

    if (result.imported > 0) {
      await logAudit({
        userId: user.id,
        entity: "TRANSACTION",
        entityId: accountId,
        action: "CREATE",
        after: {
          imported: result.imported,
          categoriesCreated: result.categoriesCreated,
          format: statement.format,
          file: file.name,
          months: result.byMonth.map((m) => m.label),
        },
        reason: `Importação de extrato (${statement.format})`,
      });

      // As duas rotas do razão têm cache próprio: sem revalidar as duas, a
      // visão geral continuaria sem os lançamentos que acabaram de entrar.
      revalidatePath("/financeiro");
      revalidatePath("/financeiro/geral");
    }

    return NextResponse.json(result);
  } catch (error) {
    // A interface usa `passwordRequired` para revelar o campo de senha em vez
    // de mostrar só uma mensagem de erro.
    if (error instanceof PdfPasswordError) {
      return NextResponse.json(
        { error: error.message, passwordRequired: true, passwordWrong: !error.missing },
        { status: 422 }
      );
    }

    if (error instanceof StatementParseError || error instanceof ImportValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("[import] falha ao processar extrato", error);
    return NextResponse.json(
      { error: "Não foi possível processar o arquivo. Confira se ele é um extrato OFX ou CSV válido." },
      { status: 500 }
    );
  }
}

/** Limite informativo, útil para quem for consumir a rota por script. */
export async function GET() {
  try {
    await requireImportAccess();
  } catch (error) {
    const status = error instanceof ImportForbiddenError ? 403 : 401;
    return NextResponse.json({ error: "Sem acesso à importação." }, { status });
  }

  return NextResponse.json({
    formats: ["OFX", "CSV", "PDF"],
    maxFileBytes: MAX_FILE_BYTES,
    maxEntriesPerImport: MAX_ENTRIES_PER_IMPORT,
    modes: ["preview", "commit"],
  });
}
