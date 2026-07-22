import { Plus, CalendarX2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AbsenceFormDialog, ABSENCE_TYPE_LABELS } from "@/components/absences/absence-form-dialog";
import { AbsenceRowActions } from "@/components/absences/absence-row-actions";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AbsenceType } from "@prisma/client";

const TYPE_VARIANTS: Record<AbsenceType, string> = {
  FALTA_JUSTIFICADA: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  FALTA_INJUSTIFICADA: "bg-red-500/10 text-red-700 dark:text-red-400",
  BANCO_HORAS: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  FOLGA: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
  FERIAS: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  LICENCA: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  COMPENSACAO: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  HOME_OFFICE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export default async function AusenciasPage() {
  const user = await requireUser();
  const now = new Date();

  const absences = await prisma.absence.findMany({
    where: { userId: user.id, date: { gte: subDays(now, 180) } },
    orderBy: { date: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CalendarX2 className="h-6 w-6" /> Ausências
        </h1>
        <p className="text-muted-foreground">
          Registre faltas, férias, licenças, folgas, home office e uso do banco de horas.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Histórico de ausências</CardTitle>
            <CardDescription>Últimos 180 dias · {absences.length} registros</CardDescription>
          </div>
          <AbsenceFormDialog
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova ausência
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Horas</TableHead>
                  <TableHead className="hidden md:table-cell">Motivo</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {absences.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Nenhuma ausência registrada
                    </TableCell>
                  </TableRow>
                )}
                {absences.map((absence) => (
                  <TableRow key={absence.id} className="animate-in fade-in">
                    <TableCell className="whitespace-nowrap">
                      {format(absence.date, "dd/MM/yyyy", { locale: ptBR })}
                      {absence.endDate && ` – ${format(absence.endDate, "dd/MM/yyyy", { locale: ptBR })}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={TYPE_VARIANTS[absence.type]}>
                        {ABSENCE_TYPE_LABELS[absence.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{absence.hours ? `${absence.hours}h` : "—"}</TableCell>
                    <TableCell className="hidden max-w-[280px] truncate text-muted-foreground md:table-cell">
                      {absence.reason ?? "—"}
                    </TableCell>
                    <TableCell>
                      <AbsenceRowActions
                        absence={{
                          id: absence.id,
                          date: format(absence.date, "yyyy-MM-dd"),
                          endDate: absence.endDate ? format(absence.endDate, "yyyy-MM-dd") : null,
                          type: absence.type,
                          hours: absence.hours,
                          reason: absence.reason,
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
  );
}
