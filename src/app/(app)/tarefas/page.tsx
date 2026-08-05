import { KanbanSquare, ListTodo, CircleCheck, AlarmClock, Flame } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBoardStats, getBoardView, resolveBoardId } from "@/lib/task-service";
import { StatCard } from "@/components/dashboard/stat-card";
import { TaskBoard } from "@/components/tasks/task-board";
import { BoardSwitcher } from "@/components/tasks/board-switcher";
import { ledgerColors } from "@/lib/chart-colors";

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ quadro?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  // Resolve o quadro (e cria o padrão na primeira visita) antes de consultar:
  // um id de outra pessoa cai no quadro do próprio usuário.
  const boardId = await resolveBoardId(user.id, params.quadro);
  const [view, stats] = await Promise.all([
    getBoardView(user.id, boardId),
    getBoardStats(boardId),
  ]);

  const now = new Date();

  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <KanbanSquare className="h-6 w-6" /> Tarefas
          </h1>
          <p className="text-muted-foreground">
            {view.board.description ??
              "Organize suas tarefas arrastando os cards entre as colunas."}
          </p>
        </div>

        <BoardSwitcher boards={view.boards} current={view.board} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Tarefas abertas"
          value={String(stats.open)}
          icon={ListTodo}
          tone="neutral"
          iconColor={ledgerColors.light.balance}
          hint={`${stats.total} no quadro`}
        />
        <StatCard
          label="Concluídas"
          value={String(stats.completed)}
          icon={CircleCheck}
          tone="good"
          iconColor={ledgerColors.light.income}
          hint={
            stats.total > 0
              ? `${Math.round((stats.completed / stats.total) * 100)}% do quadro`
              : "Nenhuma tarefa ainda"
          }
        />
        <StatCard
          label="Atrasadas"
          value={String(stats.overdue)}
          icon={AlarmClock}
          tone={stats.overdue > 0 ? "bad" : "neutral"}
          iconColor={ledgerColors.light.expense}
          hint={stats.overdue > 0 ? "Vencimento já passou" : "Nada vencido"}
        />
        <StatCard
          label="Urgentes"
          value={String(stats.urgent)}
          icon={Flame}
          tone={stats.urgent > 0 ? "bad" : "neutral"}
          iconColor={ledgerColors.light.expense}
          hint="Prioridade urgente em aberto"
        />
      </div>

      <TaskBoard boardId={view.board.id} columns={view.columns} labels={view.labels} />

      <p className="pb-6 text-center text-xs text-muted-foreground">
        Ponto+ · Gestão de tarefas · {now.getFullYear()}
      </p>
    </div>
  );
}
