import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Clock3,
  GaugeCircle,
  Siren,
  Sparkles,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ExecutiveSignalItem {
  id: string;
  label: string;
  value: number | string;
  tone: "critical" | "warning" | "ok";
  detail: string;
  onClick?: () => void;
}

export interface QuickActionItem {
  id: string;
  label: string;
  onClick: () => void;
  variant?: "default" | "secondary" | "outline" | "destructive";
}

export interface PriorityNowItem {
  id: string;
  equipment: string;
  problem: string;
  impact: string;
  downtime: string;
  tone: "critical" | "warning" | "action" | "ok";
  actionLabel: string;
  onAction: () => void;
}

const toneBadge: Record<ExecutiveSignalItem["tone"] | PriorityNowItem["tone"], string> = {
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  ok: "border-success/30 bg-success/10 text-success",
  action: "border-primary/30 bg-primary/10 text-primary",
};

const toneIcon: Record<ExecutiveSignalItem["tone"], typeof AlertTriangle> = {
  critical: Siren,
  warning: AlertTriangle,
  ok: GaugeCircle,
};

export function OperationalCommandDeck({
  items,
  actions,
}: {
  items: ExecutiveSignalItem[];
  actions: QuickActionItem[];
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Central operacional premium
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground sm:text-xl">Leitura rápida da operação</h2>
                <p className="text-sm text-muted-foreground">Indicadores críticos, ações imediatas e padrão visual executivo para despacho diário.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {actions.map((action) => (
                <Button key={action.id} variant={action.variant ?? "outline"} onClick={action.onClick} className="h-11 w-full justify-between px-4">
                  {action.label}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px bg-border/60 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const Icon = toneIcon[item.tone];
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="bg-card px-4 py-4 text-left transition-colors hover:bg-secondary/20 disabled:cursor-default disabled:hover:bg-card sm:px-5"
                disabled={!item.onClick}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    </div>
                    <p className="text-3xl font-black text-foreground">{item.value}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <Badge variant="outline" className={toneBadge[item.tone]}>
                    {item.tone === "critical" ? "Crítico" : item.tone === "warning" ? "Atenção" : "OK"}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function PriorityNowSection({ items }: { items: PriorityNowItem[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-primary" />
            <h2 className="text-base font-black text-foreground">Prioridade Agora</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Fila automática com maior impacto operacional, consumo anormal e ativos travando produção.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Nenhum item crítico priorizado neste momento.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {items.map((item, index) => (
            <Card key={item.id} className="border-border/70 bg-card shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary/40 text-xs font-black text-foreground">
                        {index + 1}
                      </div>
                      <Badge variant="outline" className={toneBadge[item.tone]}>
                        {item.tone === "critical" ? "Urgente" : item.tone === "warning" ? "Aguardando" : item.tone === "action" ? "Ação" : "OK"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-black text-foreground">{item.equipment}</CardTitle>
                    <p className="text-sm text-muted-foreground">{item.problem}</p>
                  </div>
                  <Clock3 className="mt-1 h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-secondary/25 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Impacto</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{item.impact}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/25 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Tempo parado</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{item.downtime}</p>
                  </div>
                </div>

                <Button onClick={item.onAction} className="h-11 w-full justify-between px-4" variant={item.tone === "critical" ? "destructive" : "default"}>
                  <span className="inline-flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    {item.actionLabel}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}