"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const TYPE_OPTIONS = [
  { value: "all", label: "Todos os tipos" },
  { value: "ENTRADA", label: "Entrada" },
  { value: "SAIDA_ALMOCO", label: "Saída almoço" },
  { value: "RETORNO_ALMOCO", label: "Retorno almoço" },
  { value: "SAIDA", label: "Saída" },
  { value: "FALTA_JUSTIFICADA", label: "Falta justificada" },
  { value: "FALTA_INJUSTIFICADA", label: "Falta injustificada" },
  { value: "FERIAS", label: "Férias" },
  { value: "LICENCA", label: "Licença" },
  { value: "FOLGA", label: "Folga" },
  { value: "HOME_OFFICE", label: "Home office" },
  { value: "BANCO_HORAS", label: "Banco de horas" },
  { value: "COMPENSACAO", label: "Compensação" },
];

export function SearchFilters({
  q,
  type,
  start,
  end,
}: {
  q: string;
  type: string;
  start: string;
  end: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["q", "type", "start", "end"]) {
      const value = formData.get(key);
      if (value) params.set(key, String(value));
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="q" className="text-xs">
          Palavra-chave (observações / motivo)
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar..." className="pl-8" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="start" className="text-xs">
          De
        </Label>
        <Input id="start" name="start" type="date" defaultValue={start} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="end" className="text-xs">
          Até
        </Label>
        <Input id="end" name="end" type="date" defaultValue={end} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type" className="text-xs">
          Tipo
        </Label>
        <Select name="type" items={TYPE_OPTIONS} defaultValue={type}>
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="lg:col-span-5">
        Pesquisar
      </Button>
    </form>
  );
}
