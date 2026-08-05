import { History, Plus, Pencil, Trash2, SlidersHorizontal, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AuditAction, AuditEntity } from "@prisma/client";

const ACTION_META: Record<AuditAction, { icon: typeof Plus; label: string; color: string }> = {
  CREATE: { icon: Plus, label: "Criação", color: "text-emerald-600 dark:text-emerald-400" },
  UPDATE: { icon: Pencil, label: "Edição", color: "text-blue-600 dark:text-blue-400" },
  DELETE: { icon: Trash2, label: "Exclusão", color: "text-red-600 dark:text-red-400" },
  ADJUST: { icon: SlidersHorizontal, label: "Ajuste", color: "text-violet-600 dark:text-violet-400" },
  CLOSE_MONTH: { icon: Lock, label: "Fechamento", color: "text-amber-600 dark:text-amber-400" },
};

const ENTITY_LABELS: Record<AuditEntity, string> = {
  TIME_ENTRY: "Registro de ponto",
  ABSENCE: "Ausência",
  BALANCE_ADJUSTMENT: "Banco de horas",
  WORK_SCHEDULE: "Jornada de trabalho",
  USER: "Usuário",
  GOAL: "Meta",
  TRANSACTION: "Lançamento financeiro",
  ACCOUNT: "Conta",
  CATEGORY: "Categoria",
  RECURRING_TRANSACTION: "Lançamento recorrente",
  TASK_BOARD: "Quadro de tarefas",
  TASK_COLUMN: "Coluna do quadro",
  TASK_CARD: "Card de tarefa",
};

export default async function HistoricoPage() {
  const user = await requireUser();
  const logs = await prisma.auditLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <History className="h-6 w-6" /> Histórico de alterações
        </h1>
        <p className="text-muted-foreground">Trilha de auditoria de todas as criações, edições e exclusões.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linha do tempo</CardTitle>
          <CardDescription>{logs.length} eventos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nenhum evento registrado ainda</p>
          ) : (
            <div className="max-h-[600px] space-y-1 overflow-auto pr-1">
              {logs.map((log) => {
                const meta = ACTION_META[log.action];
                const Icon = meta.icon;
                return (
                  <div key={log.id} className="flex gap-3 rounded-lg border-b border-dashed p-3 last:border-none hover:bg-muted/40">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{meta.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {ENTITY_LABELS[log.entity]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(log.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {log.reason && <p className="mt-0.5 text-sm text-muted-foreground">{log.reason}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
