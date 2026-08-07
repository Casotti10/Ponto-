"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { LogIn, Coffee, LogOut, UtensilsCrossed, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { punchNow } from "@/lib/actions/time-entries";
import { appClockString } from "@/lib/timezone";
import type { EntryType } from "@prisma/client";
import { cn } from "@/lib/utils";

const STEPS: { type: EntryType; label: string; icon: typeof LogIn }[] = [
  { type: "ENTRADA", label: "Entrada", icon: LogIn },
  { type: "SAIDA_ALMOCO", label: "Saída p/ almoço", icon: UtensilsCrossed },
  { type: "RETORNO_ALMOCO", label: "Retorno do almoço", icon: Coffee },
  { type: "SAIDA", label: "Saída", icon: LogOut },
];

export function QuickPunch({ todayEntryTypes }: { todayEntryTypes: EntryType[] }) {
  const [pending, startTransition] = useTransition();
  // O relógio é a hora do fuso do app, não a do navegador: é exatamente o
  // horário que o servidor vai gravar ao registrar a batida.
  const [clock, setClock] = useState<string | null>(null);
  const nextIndex = todayEntryTypes.length;
  const isDone = nextIndex >= STEPS.length;

  useEffect(() => {
    const tick = () => setClock(appClockString());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  function handlePunch(type: EntryType) {
    startTransition(async () => {
      const result = await punchNow(type);
      if (result.success) {
        toast.success(`${STEPS.find((s) => s.type === type)?.label} registrada às ${appClockString()}`);
      } else {
        toast.error(result.error ?? "Não foi possível registrar o ponto");
      }
    });
  }

  return (
    <Card className="overflow-hidden border-none bg-gradient-to-br from-indigo-600 via-indigo-600 to-emerald-600 text-white shadow-lg shadow-indigo-600/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-white">
          <span>Bater ponto</span>
          <span className="font-mono text-lg tabular-nums opacity-90">
            {clock ?? "--:--:--"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step.type} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium transition-all",
                  i < nextIndex ? "border-white bg-white text-indigo-600" : "border-white/40 text-white/70"
                )}
              >
                {i < nextIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-0.5 flex-1 rounded transition-all", i < nextIndex - 1 ? "bg-white" : "bg-white/30")} />
              )}
            </div>
          ))}
        </div>

        {isDone ? (
          <div className="flex items-center gap-2 rounded-lg bg-white/15 px-4 py-3 text-sm animate-in fade-in">
            <CheckCircle2 className="h-5 w-5" />
            Jornada de hoje concluída. Bom descanso!
          </div>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            className="w-full gap-2 bg-white text-indigo-700 hover:bg-white/90"
            disabled={pending}
            onClick={() => handlePunch(STEPS[nextIndex].type)}
          >
            {(() => {
              const Icon = STEPS[nextIndex].icon;
              return <Icon className="h-4 w-4" />;
            })()}
            {pending ? "Registrando..." : `Registrar ${STEPS[nextIndex].label.toLowerCase()}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
