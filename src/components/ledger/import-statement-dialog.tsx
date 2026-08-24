"use client";

import { useMemo, useRef, useState, useTransition, type ReactElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";
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
import { centsToBRL, MONTH_NAMES } from "@/lib/ledger-calc";
import type {
  ImportCandidate,
  ImportOverrides,
  ImportPreview,
  ImportResult,
  MonthBucket,
  SignMode,
} from "@/lib/import-service";

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

  // Como ler o sinal dos valores do arquivo. Trocar isto refaz o preview no
  // servidor, porque o tipo muda a categorização e os totais.
  const [signMode, setSignMode] = useState<SignMode>("auto");
  // Correções por linha feitas na conferência.
  const [overrides, setOverrides] = useState<ImportOverrides>({});

  const isPdfFile = !!file && /\.pdf$/i.test(file.name);
  const showPasswordField = isPdfFile || passwordPrompted;

  const accountItems = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  /**
   * O que a tela mostra: o preview do servidor com as correções locais já
   * aplicadas. Elas valem na hora, sem nova requisição — no commit o servidor
   * recebe `overrides` e refaz a conta por conta própria, então isto aqui é
   * apresentação, nunca a fonte da verdade.
   */
  const candidates = useMemo<ImportCandidate[]>(() => {
    if (!preview) return [];

    return preview.candidates.map((candidate) => {
      const override = overrides[candidate.externalId];
      if (!override) return candidate;

      const type = override.type ?? candidate.type;
      const flipped = type !== candidate.type;

      // Categoria pertence a um tipo. Ao virar o sinal, a que estava escolhida
      // deixa de valer — o servidor faz o mesmo.
      let categoryId = flipped ? null : candidate.categoryId;
      let categoryName = flipped ? null : candidate.categoryName;
      let suggestedCategoryName = flipped ? null : candidate.suggestedCategoryName;

      if ("categoryId" in override) {
        const chosen = preview.availableCategories.find(
          (c) => c.id === override.categoryId && c.type === type
        );
        categoryId = chosen?.id ?? null;
        categoryName = chosen?.name ?? null;
        suggestedCategoryName = null;
      }

      return { ...candidate, type, categoryId, categoryName, suggestedCategoryName };
    });
  }, [preview, overrides]);

  // Os números do topo têm que acompanhar as correções, senão a tela diria uma
  // coisa e o commit gravaria outra.
  const summary = useMemo(() => {
    if (!preview) return null;

    const novos = candidates.filter((c) => c.status === "NOVO");
    const buckets = new Map<string, MonthBucket>();

    for (const candidate of novos) {
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

    // Escolher a categoria à mão tira o lançamento da lista de "a criar", então
    // esta conta também tem que ser refeita — senão o rótulo prometeria criar
    // uma categoria que o commit não vai criar.
    const toCreate = new Map<string, { name: string; type: ImportCandidate["type"] }>();
    for (const candidate of candidates) {
      if (candidate.status === "JA_IMPORTADO" || !candidate.suggestedCategoryName) continue;
      toCreate.set(`${candidate.type}:${candidate.suggestedCategoryName}`, {
        name: candidate.suggestedCategoryName,
        type: candidate.type,
      });
    }

    return {
      ...preview.summary,
      novos: novos.length,
      possiveisDuplicados: candidates.filter((c) => c.status === "POSSIVEL_DUPLICADO").length,
      incomeCents: novos.filter((c) => c.type === "ENTRADA").reduce((s, c) => s + c.amountCents, 0),
      expenseCents: novos.filter((c) => c.type === "SAIDA").reduce((s, c) => s + c.amountCents, 0),
      byMonth: [...buckets.values()].sort((a, b) => a.year - b.year || a.month - b.month),
      categoriesToCreate: [...toCreate.values()],
    };
  }, [preview, candidates]);

  function setOverride(externalId: string, patch: ImportOverrides[string]) {
    setOverrides((current) => ({
      ...current,
      [externalId]: { ...current[externalId], ...patch },
    }));
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
    setIncludePossibleDuplicates(false);
    setCreateMissingCategories(true);
    // A senha não sobrevive ao fechamento do diálogo.
    setPassword("");
    setPasswordPrompted(false);
    setSignMode("auto");
    setOverrides({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function send(mode: "preview" | "commit", opts?: { signMode?: SignMode }) {
    if (!file || !accountId) return null;

    const body = new FormData();
    body.append("file", file);
    body.append("accountId", accountId);
    body.append("mode", mode);
    body.append("includePossibleDuplicates", String(includePossibleDuplicates));
    body.append("createMissingCategories", String(createMissingCategories));
    // Explícito, e não lido do estado: quando o usuário troca o modo, esta
    // chamada acontece no mesmo tick do `setSignMode` e leria o valor antigo.
    body.append("signMode", opts?.signMode ?? signMode);
    if (Object.keys(overrides).length > 0) {
      body.append("overrides", JSON.stringify(overrides));
    }
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

  function handlePreview(nextSignMode?: SignMode) {
    setError(null);
    startTransition(async () => {
      try {
        const result = (await send("preview", { signMode: nextSignMode })) as ImportPreview | null;
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

          <div className="space-y-2">
            <Label htmlFor="import-sign">Como interpretar os valores</Label>
            <select
              id="import-sign"
              value={signMode}
              onChange={(e) => {
                const next = e.target.value as SignMode;
                setSignMode(next);
                // As correções por linha foram feitas sobre a interpretação
                // anterior; mantê-las depois de virar tudo seria enganoso.
                setOverrides({});
                if (preview) handlePreview(next);
              }}
              className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
            >
              <option value="auto">Automático — usar o sinal do arquivo</option>
              <option value="expense">Tudo como despesa (saída)</option>
              <option value="income">Tudo como receita (entrada)</option>
              <option value="invert">Inverter os sinais do arquivo</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Fatura de cartão costuma listar compras como número positivo — nesses casos, “tudo
              como despesa”. Depois de conferir, dá para virar o sinal de cada lançamento
              individualmente.
            </p>
          </div>

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
                <div className="max-h-80 divide-y overflow-auto rounded-md border">
                  {candidates.map((candidate) => {
                    const locked = candidate.status === "JA_IMPORTADO";
                    const isIncome = candidate.type === "ENTRADA";
                    // A categoria pertence a um tipo: quem está classificando
                    // uma despesa não pode ver "Salário" na lista.
                    const options = preview.availableCategories.filter(
                      (c) => c.type === candidate.type
                    );

                    return (
                      <div
                        key={candidate.externalId}
                        className={cn("px-3 py-2 text-sm", locked && "opacity-50")}
                      >
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{candidate.description}</p>
                            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span>{candidate.date.split("-").reverse().join("/")}</span>
                              {candidate.suggestedCategoryName && (
                                <span>· {candidate.suggestedCategoryName} (será criada)</span>
                              )}
                              {candidate.status !== "NOVO" && (
                                <Badge
                                  variant={locked ? "secondary" : "outline"}
                                  className="px-1 py-0 text-[10px]"
                                >
                                  {STATUS_LABEL[candidate.status]}
                                </Badge>
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={locked}
                            onClick={() =>
                              setOverride(candidate.externalId, {
                                type: isIncome ? "SAIDA" : "ENTRADA",
                              })
                            }
                            title={
                              isIncome
                                ? "Marcar como despesa"
                                : "Marcar como receita"
                            }
                            aria-label={`${candidate.description}: ${
                              isIncome ? "entrada" : "saída"
                            } de ${centsToBRL(candidate.amountCents)}. Clique para inverter.`}
                            className={cn(
                              "flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-sm font-medium tabular-nums transition-colors",
                              isIncome
                                ? "border-emerald-600/30 text-emerald-600 hover:bg-emerald-600/10 dark:text-emerald-500"
                                : "border-red-600/30 text-red-600 hover:bg-red-600/10 dark:text-red-500",
                              locked && "pointer-events-none"
                            )}
                          >
                            {isIncome ? (
                              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {isIncome ? "+" : "−"}
                            {centsToBRL(candidate.amountCents)}
                          </button>
                        </div>

                        {!locked && (
                          <select
                            value={candidate.categoryId ?? ""}
                            disabled={options.length === 0}
                            onChange={(e) =>
                              setOverride(candidate.externalId, {
                                categoryId: e.target.value || null,
                              })
                            }
                            aria-label={`Categoria de ${candidate.description}`}
                            className="mt-1.5 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs disabled:opacity-50"
                          >
                            <option value="">
                              {options.length === 0
                                ? `Nenhuma categoria de ${isIncome ? "entrada" : "saída"} cadastrada`
                                : "Sem categoria"}
                            </option>
                            {options.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
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
            // A arrow é necessária: passar `handlePreview` direto entregaria o
            // evento de clique como se fosse o modo de sinal.
            <Button
              type="button"
              onClick={() => handlePreview()}
              disabled={pending || !file || !accountId}
            >
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
