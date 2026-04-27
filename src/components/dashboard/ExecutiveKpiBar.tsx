import { type LucideIcon, Activity, AlertOctagon, Fuel, PauseCircle, Wrench } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ExecutiveKpi {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: "ok" | "warning" | "critical" | "neutral";
  icon: LucideIcon;
  onClick?: () => void;
}

const toneRing: Record<ExecutiveKpi["tone"], string> = {
  ok: "before:bg-success",
  warning: "before:bg-warning",
  critical: "before:bg-destructive",
  neutral: "before:bg-primary",
};

const toneIconBg: Record<ExecutiveKpi["tone"], string> = {
  ok: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  critical: "bg-destructive/10 text-destructive",
  neutral: "bg-primary/10 text-primary",
};

const toneValue: Record<ExecutiveKpi["tone"], string> = {
  ok: "text-success",
  warning: "text-foreground",
  critical: "text-destructive",
  neutral: "text-foreground",
};

export function ExecutiveKpiBar({ items }: { items: ExecutiveKpi[] }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.id}
            onClick={item.onClick}
            className={cn(
              "group relative overflow-hidden border-border/60 bg-card shadow-sm transition-all",
              "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
              toneRing[item.tone],
              item.onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneIconBg[item.tone])}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className={cn("mt-3 text-3xl font-black leading-none tracking-tight", toneValue[item.tone])}>
                {item.value}
              </p>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.hint}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

// Convenience icons re-export to avoid extra imports at call site.
export const KpiIcons = { Activity, AlertOctagon, Fuel, PauseCircle, Wrench };
