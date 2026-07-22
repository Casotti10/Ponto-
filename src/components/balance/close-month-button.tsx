"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closeMonthAction } from "@/lib/actions/balance";

export function CloseMonthButton({ year, month }: { year: number; month: number }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await closeMonthAction(year, month);
      if (result.success) toast.success(`Fechamento de ${month}/${year} concluído`);
      else toast.error(result.error ?? "Não foi possível fechar o mês");
    });
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleClick} disabled={pending}>
      <Lock className="h-3.5 w-3.5" /> {pending ? "Fechando..." : "Fechar mês atual"}
    </Button>
  );
}
