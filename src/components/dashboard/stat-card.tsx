import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: "neutral" | "good" | "bad";
  iconColor?: string;
}

export function StatCard({ label, value, icon: Icon, hint, tone = "neutral", iconColor }: StatCardProps) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: iconColor ? `${iconColor}1a` : "var(--muted)",
            color: iconColor ?? "var(--muted-foreground)",
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-2xl font-semibold leading-tight",
              tone === "good" && "text-emerald-600 dark:text-emerald-400",
              tone === "bad" && "text-red-600 dark:text-red-400"
            )}
          >
            {value}
          </p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
