import { requireUser } from "@/lib/auth";

/**
 * Quem pode importar extrato bancário.
 *
 * A importação é um recurso restrito de propósito: ela escreve lançamentos em
 * lote a partir de um arquivo enviado pelo usuário, e o parser aceita formatos
 * de bancos variados. Enquanto ela não for exercitada por mais gente, fica
 * limitada a uma lista de e-mails.
 *
 * O padrão é o dono do projeto. `LEDGER_IMPORT_ALLOWLIST` (lista separada por
 * vírgula) substitui a lista sem precisar de deploy de código.
 */
const DEFAULT_ALLOWLIST = ["lucascasotti1@gmail.com"];

function allowlist(): string[] {
  const configured = process.env.LEDGER_IMPORT_ALLOWLIST;
  if (!configured) return DEFAULT_ALLOWLIST;

  const emails = configured
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  // Uma variável presente mas vazia significaria "ninguém pode", o que é um
  // jeito silencioso de quebrar o recurso por erro de digitação no painel.
  return emails.length > 0 ? emails : DEFAULT_ALLOWLIST;
}

export function canImportLedger(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowlist().includes(email.trim().toLowerCase());
}

export class ImportForbiddenError extends Error {
  constructor() {
    super("FORBIDDEN");
    this.name = "ImportForbiddenError";
  }
}

/**
 * Autentica e confere a allowlist. Use no lugar de `requireUser()` em tudo que
 * for importação — assim a checagem não depende de o chamador lembrar dela.
 */
export async function requireImportAccess() {
  const user = await requireUser();
  if (!canImportLedger(user.email)) throw new ImportForbiddenError();
  return user;
}
