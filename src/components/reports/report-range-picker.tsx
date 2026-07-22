"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RANGE_OPTIONS = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
  { value: "custom", label: "Personalizado" },
];

export function ReportRangePicker({ range, start, end }: { range: string; start: string; end: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateRange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function updateCustomDate(key: "start" | "end", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Tabs value={range} onValueChange={(v) => v && updateRange(v)}>
        <TabsList>
          {RANGE_OPTIONS.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value}>
              {opt.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {range === "custom" && (
        <div className="flex items-center gap-2">
          <Label htmlFor="start" className="text-xs text-muted-foreground">
            De
          </Label>
          <Input id="start" type="date" className="h-8 w-36" defaultValue={start} onChange={(e) => updateCustomDate("start", e.target.value)} />
          <Label htmlFor="end" className="text-xs text-muted-foreground">
            Até
          </Label>
          <Input id="end" type="date" className="h-8 w-36" defaultValue={end} onChange={(e) => updateCustomDate("end", e.target.value)} />
        </div>
      )}
    </div>
  );
}
