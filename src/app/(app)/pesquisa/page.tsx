import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchFilters } from "@/components/search/search-filters";
import { ABSENCE_TYPE_LABELS } from "@/components/absences/absence-form-dialog";
import { format, subMonths } from "date-fns";
import { appNow } from "@/lib/timezone";
import { ptBR } from "date-fns/locale";
import type { EntryType, Prisma } from "@prisma/client";

const ENTRY_TYPES: EntryType[] = ["ENTRADA", "SAIDA_ALMOCO", "RETORNO_ALMOCO", "SAIDA"];

const ENTRY_TYPE_LABELS: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA_ALMOCO: "Saída almoço",
  RETORNO_ALMOCO: "Retorno almoço",
  SAIDA: "Saída",
};

interface SearchResultRow {
  id: string;
  date: Date;
  kind: "Ponto" | "Ausência";
  typeLabel: string;
  detail: string;
}

export default async function PesquisaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; start?: string; end?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params.q ?? "";
  const type = params.type ?? "all";
  const now = appNow();
  const start = params.start ? new Date(`${params.start}T00:00:00`) : subMonths(now, 3);
  const end = params.end ? new Date(`${params.end}T23:59:59`) : now;

  const results: SearchResultRow[] = [];

  const isEntryType = ENTRY_TYPES.includes(type as EntryType);
  if (type === "all" || isEntryType) {
    const entryWhere: Prisma.TimeEntryWhereInput = {
      userId: user.id,
      date: { gte: start, lte: end },
      ...(isEntryType ? { type: type as EntryType } : {}),
      ...(q ? { notes: { contains: q, mode: "insensitive" } } : {}),
    };
    const entries = await prisma.timeEntry.findMany({ where: entryWhere, orderBy: { time: "desc" }, take: 200 });
    for (const e of entries) {
      results.push({
        id: e.id,
        date: e.time,
        kind: "Ponto",
        typeLabel: ENTRY_TYPE_LABELS[e.type],
        detail: e.notes ?? "—",
      });
    }
  }

  const isAbsenceType = Object.keys(ABSENCE_TYPE_LABELS).includes(type);
  if (type === "all" || isAbsenceType) {
    const absenceWhere: Prisma.AbsenceWhereInput = {
      userId: user.id,
      date: { gte: start, lte: end },
      ...(isAbsenceType ? { type: type as never } : {}),
      ...(q ? { reason: { contains: q, mode: "insensitive" } } : {}),
    };
    const absences = await prisma.absence.findMany({ where: absenceWhere, orderBy: { date: "desc" }, take: 200 });
    for (const a of absences) {
      results.push({
        id: a.id,
        date: a.date,
        kind: "Ausência",
        typeLabel: ABSENCE_TYPE_LABELS[a.type],
        detail: a.reason ?? "—",
      });
    }
  }

  results.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Search className="h-6 w-6" /> Pesquisa
        </h1>
        <p className="text-muted-foreground">Busque registros de ponto e ausências por data, tipo ou observações.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <SearchFilters q={q} type={type} start={params.start ?? format(start, "yyyy-MM-dd")} end={params.end ?? format(end, "yyyy-MM-dd")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>{results.length} registros encontrados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[520px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      Nenhum resultado encontrado
                    </TableCell>
                  </TableRow>
                )}
                {results.map((r) => (
                  <TableRow key={`${r.kind}-${r.id}`}>
                    <TableCell className="whitespace-nowrap">{format(r.date, "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell>
                      <Badge variant={r.kind === "Ponto" ? "default" : "secondary"}>{r.kind}</Badge>
                    </TableCell>
                    <TableCell>{r.typeLabel}</TableCell>
                    <TableCell className="max-w-[360px] truncate text-muted-foreground">{r.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
