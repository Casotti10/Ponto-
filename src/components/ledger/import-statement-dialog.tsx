"use client";

import { useRef, useState, useTransition, type ReactElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { centsToBRL } from "@/lib/ledger-calc";
import type { ImportPreview, ImportResult } from "@/lib/import-service";

interface Props {
  accounts: { id: string; name: string }[];
  trigger?: ReactElement;
  children?: ReactNode;
}

const STATUS_LABEL: Record<string, string> = {
  NOVO: "Novo",
  JA_IMPORTADO: "Já importado",
  POSSIVEL_DUPLICADO: "Possível duplicado",
};

/** Erro da rota que carrega o sinal de "precisa de senha" junto da mensagem. */
class ImportRequestError extends Error {
  readonly passwordRequired: boolean;

  constructor(message: string, passwordRequired: boolean) {
    super(message);
    this.passwordRequired = passwordRequired;
  }
}

/**
 * Importação de extrato bancário em duas etapas.
 *
 * O arquivo é enviado DUAS vezes: uma para o preview e outra para gravar. É de
 * propósito — o servidor reprocessa o extrato no commit em vez de aceitar a
 * lista de lançamentos que está na tela, então nada que o navegador editar pode
 * virar lançamento no banco.
 */
export function ImportStatementDialog({ accounts, trigger, children }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includePossibleDuplicates, setIncludePossibleDuplicates] = useState(false);
  const [createMissingCategories, setCreateMissingCategories] = useState(true);
  // Senha de PDF protegido. Vive só neste estado: vai no corpo da requisição,
  // o servidor usa para abrir o documento e ninguém grava em lugar nenhum.
  const [password, setPassword] = useState("");
  // O servidor pode detectar PDF pelos bytes mesmo num arquivo com outra
  // extensão; nesse caso é a resposta dele que revela o campo.
  const [passwordPrompted, setPasswordPrompted] = useState(false);
  const [pending, startTransition] = useTransition();

  const isPdfFile = !!file && /\.pdf$/i.test(file.name);
  const showPasswordField = isPdfFile || passwordPrompted;

  const accountItems = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
    setIncludePossibleDuplicates(false);
    setCreateMissingCategories(true);
    // A senha não sobrevive ao fechamento do diálogo.
    setPassword("");
    setPasswordPrompted(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function send(mode: "preview" | "commit") {
    if (!file || !accountId) return null;

    const body = new FormData();
    body.append("file", file);
    body.append("accountId", accountId);
    body.append("mode", mode);
    body.append("includePossibleDuplicates", String(includePossibleDuplicates));
    body.append("createMissingCategories", String(createMissingCategories));
    if (password) body.append("password", password);

    const response = await fetch("/api/financeiro/import", { method: "POST", body });
    const payload = await response.json();

    if (!response.ok) {
      throw new ImportRequestError(
        payload?.error ?? "Não foi possível processar o arquivo.",
        payload?.passwordRequired === true
      );
    }

    return payload;
  }

  function handlePreview() {
    setError(null);
    startTransition(async () => {
      try {
        const result = (await send("preview")) as ImportPreview | null;
        if (result) setPreview(result);
      } catch (e) {
        if (e instanceof ImportRequestError && e.passwordRequired) setPasswordPrompted(true);
        setError(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
      }
    });
  }

  function handleCommit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = (await send("commit")) as ImportResult | null;
        if (!result) return;

        if (result.imported === 0) {
          toast.info("Nada novo para importar — todos os lançamentos já estavam no razão.");
        } else {
          const months = result.byMonth.map((m) => m.label).join(", ");
          toast.success(
            `${result.imported} lançamento(s) importado(s)` + (months ? ` em ${months}.` : "."),
            {
              description:
                result.categoriesCreated > 0
                  ? `${result.categoriesCreated} categoria(s) criada(s) automaticamente.`
                  : undefined,
            }
          );
        }

        handleOpenChange(false);
        // O período na tela não muda: os lançamentos aparecem no mês a que
        // pertencem, e o refresh reconsulta o Server Component do mês aberto.
        router.refresh();
      } catch (e) {
        if (e instanceof ImportRequestError && e.passwordRequired) setPasswordPrompted(true);
        setError(e instanceof Error ? e.message : "Falha ao importar.");
      }
    });
  }

  const summary = preview?.summary;
  const importable =
    (summary?.novos ?? 0) + (includePossibleDuplicates ? (summary?.possiveisDuplicados ?? 0) : 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger render={trigger}>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar extrato bancário</DialogTitle>
          <DialogDescription>
            Envie o extrato ou a fatura exportados pelo app do seu banco — OFX, CSV ou PDF. Cada
            lançamento entra no mês da própria data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="import-account">Conta de destino</Label>
              <Select
                name="accountId"
                items={accountItems}
                value={accountId}
                onValueChange={(v) => {
                  setAccountId(String(v));
                  // A duplicidade é conferida por conta; trocar a conta invalida
                  // o preview que está na tela.
                  setPreview(null);
                }}
              >
                <SelectTrigger id="import-account" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-file">Arquivo</Label>
              <input
                ref={fileInputRef}
                id="import-file"
                type="file"
                accept=".ofx,.csv,.txt,.pdf,text/csv,application/pdf,application/x-ofx"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setError(null);
                }}
                className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
              />
            </div>
          </div>

          {showPasswordField && (
            <div className="space-y-2">
              <Label htmlFor="import-password">Senha do PDF (se houver)</Label>
              <Input
                id="import-password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Deixe em branco se o arquivo abrir sem senha"
              />
              <p className="text-xs text-muted-foreground">
                Bancos costumam proteger a fatura com dígitos do CPF ou a data de nascimento. A
                senha é usada só para abrir o arquivo e não fica guardada.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {preview && summary && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{preview.format}</Badge>
                {preview.bankId && <span>Banco {preview.bankId}</span>}
                {preview.statementAccountId && <span>· Conta {preview.statementAccountId}</span>}
                {preview.periodStart && preview.periodEnd && (
                  <span>
                    · {preview.periodStart.split("-").reverse().join("/")} a{" "}
                    {preview.periodEnd.split("-").reverse().join("/")}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Novos" value={String(summary.novos)} tone="good" />
                <Stat label="Já importados" value={String(summary.jaImportados)} />
                <Stat label="A conferir" value={String(summary.possiveisDuplicados)} tone={summary.possiveisDuplicados > 0 ? "warn" : undefined} />
                <Stat label="Descartados" value={String(preview.skipped.length)} />
              </div>

              {summary.byMonth.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Distribuição por mês
                  </p>
                  <div className="space-y-1.5">
                    {summary.byMonth.map((bucket) => (
                      <div
                        key={`${bucket.year}-${bucket.month}`}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{bucket.label}</span>
                        <span className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">{bucket.count} lanç.</span>
                          {bucket.incomeCents > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-500">
                              +{centsToBRL(bucket.incomeCents)}
                            </span>
                          )}
                          {bucket.expenseCents > 0 && (
                            <span className="text-red-600 dark:text-red-500">
                              −{centsToBRL(bucket.expenseCents)}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Lançamentos lidos ({summary.total})
                </p>
                <div className="max-h-64 divide-y overflow-auto rounded-md border">
                  {preview.candidates.map((candidate) => (
                    <div
                      key={candidate.externalId}
                      className={cn(
                        "flex items-center justify-between gap-3 px-3 py-2 text-sm",
                        candidate.status === "JA_IMPORTADO" && "opacity-50"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{candidate.description}</p>
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{candidate.date.split("-").reverse().join("/")}</span>
                          {candidate.categoryName && <span>· {candidate.categoryName}</span>}
                          {candidate.suggestedCategoryName && (
                            <span>· {candidate.suggestedCategoryName} (nova)</span>
                          )}
                          {candidate.status !== "NOVO" && (
                            <Badge
                              variant={candidate.status === "JA_IMPORTADO" ? "secondary" : "outline"}
                              className="px-1 py-0 text-[10px]"
                            >
                              {STATUS_LABEL[candidate.status]}
                            </Badge>
                          )}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-medium tabular-nums",
                          candidate.type === "ENTRADA"
                            ? "text-emerald-600 dark:text-emerald-500"
                            : "text-red-600 dark:text-red-500"
                        )}
                      >
                        {candidate.type === "ENTRADA" ? "+" : "−"}
                        {centsToBRL(candidate.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {summary.categoriesToCreate.length > 0 && (
                  <label className="flex items-start gap-2.5 text-sm">
                    <Checkbox
                      checked={createMissingCategories}
                      onCheckedChange={(c) => setCreateMissingCategories(c === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Criar {summary.categoriesToCreate.length} categoria(s) sugerida(s)
                      <span className="block text-xs text-muted-foreground">
                        {summary.categoriesToCreate.map((c) => c.name).join(", ")}
                      </span>
                    </span>
                  </label>
                )}

                {summary.possiveisDuplicados > 0 && (
                  <label className="flex items-start gap-2.5 text-sm">
                    <Checkbox
                      checked={includePossibleDuplicates}
                      onCheckedChange={(c) => setIncludePossibleDuplicates(c === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Importar também os {summary.possiveisDuplicados} possíveis duplicados
                      <span className="block text-xs text-muted-foreground">
                        Batem em data, valor e tipo com lançamentos que você digitou à mão.
                      </span>
                    </span>
                  </label>
                )}
              </div>

              {preview.skipped.length > 0 && (
                <details className="rounded-md border px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    {preview.skipped.length} linha(s) descartada(s)
                  </summary>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {preview.skipped.slice(0, 20).map((row, i) => (
                      <li key={i} className="truncate">
                        Linha {row.line}: {row.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          {preview ? (
            <Button type="button" onClick={handleCommit} disabled={pending || importable === 0}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Importando...
                </>
              ) : importable === 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Nada a importar
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Importar {importable}
                </>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={handlePreview} disabled={pending || !file || !accountId}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Lendo...
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4" /> Conferir extrato
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-500",
          tone === "warn" && "text-amber-600 dark:text-amber-500"
        )}
      >
        {value}
      </p>
    </div>
  );
}
