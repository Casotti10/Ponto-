"use client";

import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  StickyNote,
  Tag,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { ActivityView } from "@/lib/task-service";

/** Ícone e cor por tipo de evento. Chave em string porque o tipo vem serializado. */
const ACTIVITY_META: Record<string, { icon: LucideIcon; color: string }> = {
  CARD_CREATED: { icon: Plus, color: "text-emerald-600 dark:text-emerald-400" },
  CARD_MOVED: { icon: ArrowRightLeft, color: "text-blue-600 dark:text-blue-400" },
  CARD_RENAMED: { icon: Type, color: "text-violet-600 dark:text-violet-400" },
  CARD_UPDATED: { icon: Pencil, color: "text-blue-600 dark:text-blue-400" },
  CARD_DUPLICATED: { icon: Copy, color: "text-blue-600 dark:text-blue-400" },
  CARD_COMPLETED: { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
  CARD_REOPENED: { icon: RotateCcw, color: "text-amber-600 dark:text-amber-400" },
  CARD_DELETED: { icon: Trash2, color: "text-red-600 dark:text-red-400" },
  CHECKLIST_UPDATED: { icon: ListChecks, color: "text-violet-600 dark:text-violet-400" },
  NOTES_UPDATED: { icon: StickyNote, color: "text-amber-600 dark:text-amber-400" },
  LABELS_UPDATED: { icon: Tag, color: "text-blue-600 dark:text-blue-400" },
  COLUMN_CREATED: { icon: Plus, color: "text-emerald-600 dark:text-emerald-400" },
  COLUMN_RENAMED: { icon: Type, color: "text-violet-600 dark:text-violet-400" },
  COLUMN_DELETED: { icon: Trash2, color: "text-red-600 dark:text-red-400" },
};

const FALLBACK = { icon: Pencil, color: "text-muted-foreground" };

/**
 * "Hoje às 10:32" diz mais que "04/08/2026 às 10:32" para algo que acabou de
 * acontecer — e é assim que a pessoa se lembra do próprio dia.
 */
function formatMoment(iso: string) {
  const date = new Date(iso);
  if (isToday(date)) return `Hoje às ${format(date, "HH:mm")}`;
  if (isYesterday(date)) return `Ontem às ${format(date, "HH:mm")}`;
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function CardActivity({ activities }: { activities: ActivityView[] }) {
  if (activities.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
        Nenhum evento registrado ainda.
      </p>
    );
  }

  return (
    <ol className="space-y-1">
      {activities.map((activity) => {
        const meta = ACTIVITY_META[activity.type] ?? FALLBACK;
        const Icon = meta.icon;
        return (
          <li
            key={activity.id}
            className="flex gap-3 rounded-lg border-b border-dashed p-2.5 last:border-none hover:bg-muted/40"
          >
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted ${meta.color}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm break-words">
                <span className="font-medium">{activity.userName}</span> {activity.message}
              </p>
              <p className="text-xs text-muted-foreground">{formatMoment(activity.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
