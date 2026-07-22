import { Plus, Fingerprint } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuickPunch } from "@/components/timeentry/quick-punch";
import { TimeEntryFormDialog } from "@/components/timeentry/time-entry-form-dialog";
import { EntryRowActions } from "@/components/timeentry/entry-row-actions";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { EntryType } from "@prisma/client";

const TYPE_LABELS: Record<EntryType, string> = {
  ENTRADA: "Entrada",
  SAIDA_ALMOCO: "Saída almoço",
  RETORNO_ALMOCO: "Retorno almoço",
  SAIDA: "Saída",
};

const TYPE_VARIANTS: Record<EntryType, string> = {
  ENTRADA: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  SAIDA_ALMOCO: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  RETORNO_ALMOCO: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  SAIDA: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  PONTO_RAPIDO: "Ponto rápido",
  IMPORTACAO: "Importação",
  AJUSTE: "Ajuste",
};

export default async function PontoPage() {
  const user = await requireUser();
  const now = new Date();
  const todayEntries = await prisma.timeEntry.findMany({
    where: { userId: user.id, date: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
    orderBy: { time: "asc" },
  });

  const entries = await prisma.timeEntry.findMany({
    where: { userId: user.id, date: { gte: subDays(now, 60) } },
    orderBy: [{ date: "desc" }, { time: "desc" }],
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Fingerprint className="h-6 w-6" /> Registro de Ponto
        </h1>
        <p className="text-muted-foreground">Bata o ponto do dia e gerencie manualmente seus registros.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <QuickPunch todayEntryTypes={todayEntries.map((e) => e.type)} />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Histórico de registros</CardTitle>
              <CardDescription>Últimos 60 dias · {entries.length} registros</CardDescription>
            </div>
            <TimeEntryFormDialog
              trigger={
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Novo registro
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            <div className="max-h-[520px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead className="hidden md:table-cell">Observações</TableHead>
                    <TableHead className="hidden sm:table-cell">Origem</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  )}
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className="animate-in fade-in">
                      <TableCell className="whitespace-nowrap">
                        {format(entry.date, "dd/MM/yyyy (EEE)", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={TYPE_VARIANTS[entry.type]}>
                          {TYPE_LABELS[entry.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">{format(entry.time, "HH:mm")}</TableCell>
                      <TableCell className="hidden max-w-[200px] truncate text-muted-foreground md:table-cell">
                        {entry.notes ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                        {SOURCE_LABELS[entry.source]}
                      </TableCell>
                      <TableCell>
                        <EntryRowActions
                          entry={{
                            id: entry.id,
                            date: format(entry.date, "yyyy-MM-dd"),
                            time: format(entry.time, "HH:mm"),
                            type: entry.type,
                            notes: entry.notes,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
