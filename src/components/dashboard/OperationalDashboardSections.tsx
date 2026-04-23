import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Droplets, Eye, Fuel, PauseCircle, TimerReset, Truck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DashboardAlertItem {
  id: string;
  label: string;
  value: number;
  description: string;
  actionLabel: string;
  onClick: () => void;
  icon: typeof AlertTriangle;
  tone: "critical" | "warning" | "ok";
}

export interface DashboardKpiItem {
  id: string;
  label: string;
  value: string;
  context: string;
  icon: typeof Truck;
  onClick: () => void;
}

export interface MaintenancePriorityItem {
  id: string;
  equipmentName: string;
  currentHourMeter: number;
  status: "ok" | "approaching" | "overdue";
  timingLabel: string;
  planLabel: string;
  onOpen: () => void;
}

export interface WorkOrderStatusItem {
  id: string;
  label: string;
  count: number;
  description: string;
  icon: typeof Wrench;
  tone: "critical" | "warning" | "ok" | "neutral";
  onClick: () => void;
}

export interface ConsumptionInsightItem {
  id: string;
  equipmentName: string;
  variationPercent: number;
  metricLabel: string;
  severity: "warning" | "critical";
}

export interface ChecklistOverviewItem {
  id: string;
  equipmentName: string;
  operatorName: string;
  typeLabel: string;
  timeLabel: string;
  status: "ok" | "attention" | "critical";
  nonConformities: number;
  onClick: () => void;
}

export interface ComboFuelItem {
  id: string;
  name: string;
  currentFuel: number;
  fuelCapacity: number;
  percentage: number;
}

const toneClasses: Record<DashboardAlertItem["tone"] | WorkOrderStatusItem["tone"], string> = {
  critical: "border-destructive/30 bg-destructive/10",
  warning: "border-warning/30 bg-warning/10",
  ok: "border-success/30 bg-success/10",
  neutral: "border-border bg-secondary/40",
};

const toneTextClasses: Record<DashboardAlertItem["tone"] | WorkOrderStatusItem["tone"], string> = {
  critical: "text-destructive",
  warning: "text-warning",
  ok: "text-success",
  neutral: "text-foreground",
};

const maintenanceStatusClasses: Record<MaintenancePriorityItem["status"], string> = {
  overdue: "border-destructive/30 bg-destructive/10 text-destructive",
  approaching: "border-warning/30 bg-warning/10 text-warning",
  ok: "border-success/30 bg-success/10 text-success",
};

const maintenanceStatusLabels: Record<MaintenancePriorityItem["status"], string> = {
  overdue: "ATRASADA",
  approaching: "PRÓXIMA",
  ok: "EM DIA",
};

const checklistStatusClasses: Record<ChecklistOverviewItem["status"], string> = {
  ok: "border-success/20 bg-success/10",
  attention: "border-warning/20 bg-warning/10",
  critical: "border-destructive/20 bg-destructive/10",
};

const checklistTextClasses: Record<ChecklistOverviewItem["status"], string> = {
  ok: "text-success",
  attention: "text-warning",
  critical: "text-destructive",
};

function SectionHeader({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof Truck;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h2 className="text-base font-black text-foreground">{title}</h2>
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button variant="ghost" size="sm" onClick={onAction} className="h-8 shrink-0 px-2 text-xs">
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function DashboardHero({
  title,
  subtitle,
  summary,
  onRefresh,
  onSignOut,
  refreshing,
}: {
  title: string;
  subtitle: string;
  summary: string;
  onRefresh: () => void;
  onSignOut: () => void;
  refreshing: boolean;
}) {
  return (
    <Card className="border-primary/20 bg-card shadow-sm">
      <CardHeader className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Painel operacional</p>
            <div>
              <h1 className="text-2xl font-black text-foreground sm:text-3xl">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex gap-2 self-start">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? "Atualizando..." : "Atualizar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sair
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo inteligente</p>
          <p className="mt-2 text-sm leading-6 text-foreground">{summary}</p>
        </div>
      </CardHeader>
    </Card>
  );
}

export function CriticalAlertsPanel({ items }: { items: DashboardAlertItem[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader
        icon={AlertTriangle}
        title="Alertas prioritários"
        description="Tudo o que exige ação imediata em manutenção, operação e consumo."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.id} className={toneClasses[item.tone]}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${toneTextClasses[item.tone]}`} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    </div>
                    <p className={`text-3xl font-black ${toneTextClasses[item.tone]}`}>{item.value}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <Button variant={item.tone === "critical" ? "destructive" : "outline"} size="sm" onClick={item.onClick}>
                    {item.actionLabel}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function KpiSummaryGrid({ items }: { items: DashboardKpiItem[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader icon={Truck} title="KPIs principais" description="Visão consolidada da operação com contexto para priorização." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className="rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-secondary/40"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
              </div>
              <p className="mt-3 text-3xl font-black text-foreground">{item.value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.context}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function MaintenancePriorityList({ items, onOpenAll }: { items: MaintenancePriorityItem[]; onOpenAll: () => void }) {
  return (
    <section className="space-y-3">
      <SectionHeader
        icon={TimerReset}
        title="Manutenção preventiva"
        description="Ordenado por prioridade operacional: atrasadas, próximas e em dia."
        actionLabel="Ver manutenção"
        onAction={onOpenAll}
      />
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum plano de manutenção encontrado.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{item.equipmentName}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${maintenanceStatusClasses[item.status]}`}>
                        {maintenanceStatusLabels[item.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>Horímetro: <strong className="text-foreground">{item.currentHourMeter}</strong></span>
                      <span>{item.planLabel}</span>
                      <span>{item.timingLabel}</span>
                    </div>
                  </div>
                  <Button size="sm" onClick={item.onOpen} className="w-full sm:w-auto">
                    Abrir OS
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function WorkOrdersOperationalBlock({ items }: { items: WorkOrderStatusItem[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader icon={Wrench} title="Ordens de serviço" description="Leitura operacional do volume, urgência e bloqueios das OS." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`rounded-lg border p-4 text-left shadow-sm transition-colors hover:bg-secondary/30 ${toneClasses[item.tone]}`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${toneTextClasses[item.tone]}`} />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
              </div>
              <p className={`mt-3 text-3xl font-black ${toneTextClasses[item.tone]}`}>{item.count}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ConsumptionInsightsBlock({
  items,
  onOpenReports,
}: {
  items: ConsumptionInsightItem[];
  onOpenReports: () => void;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        icon={Fuel}
        title="Consumo inteligente"
        description="Equipamentos com comportamento de consumo acima do padrão da operação."
        actionLabel="Abrir relatórios"
        onAction={onOpenReports}
      />
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum consumo fora do padrão identificado.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => {
                const tone = item.severity === "critical" ? "critical" : "warning";
                return (
                  <div key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{item.equipmentName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.metricLabel}</p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${toneClasses[tone]} ${toneTextClasses[tone]}`}>
                        +{item.variationPercent.toFixed(0)}%
                      </span>
                      <span className={`text-sm font-semibold ${toneTextClasses[tone]}`}>
                        {item.severity === "critical" ? "Crítico" : "Atenção"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function ChecklistOverviewSection({ items }: { items: ChecklistOverviewItem[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader icon={ClipboardCheck} title="Checklists de hoje" description="Últimas inspeções registradas no dia, com acesso rápido ao detalhe." />
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum checklist registrado hoje.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/30 ${checklistStatusClasses[item.status]}`}
                >
                  <Eye className={`h-4 w-4 shrink-0 ${checklistTextClasses[item.status]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{item.equipmentName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.operatorName} · {item.typeLabel} · {item.timeLabel}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {item.nonConformities > 0 && <p className="text-xs font-bold text-destructive">{item.nonConformities} NC</p>}
                    <p className={`text-xs font-semibold ${checklistTextClasses[item.status]}`}>{item.status === "ok" ? "OK" : item.status === "attention" ? "Atenção" : "Crítico"}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function ComboFuelSection({ items, onOpenSupply }: { items: ComboFuelItem[]; onOpenSupply: () => void }) {
  return (
    <section className="space-y-3">
      <SectionHeader icon={Droplets} title="Saldo dos comboios" description="Capacidade disponível para atender a operação." actionLabel="Reabastecer" onAction={onOpenSupply} />
      <Card>
        <CardContent className="space-y-3 p-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum comboio cadastrado.</p>
          ) : (
            items.map((item) => {
              const tone = item.percentage <= 10 ? "critical" : item.percentage <= 30 ? "warning" : "ok";
              return (
                <div key={item.id} className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-foreground">{item.name}</p>
                    <span className={`text-sm font-bold ${toneTextClasses[tone]}`}>{item.currentFuel}L / {item.fuelCapacity}L</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className={`h-2 rounded-full ${tone === "critical" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function EmptyOperationalState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-success" />
        <div>
          <p className="text-sm font-bold text-foreground">Operação sob controle</p>
          <p className="mt-1 text-sm text-muted-foreground">Nenhum item crítico identificado neste momento.</p>
        </div>
      </CardContent>
    </Card>
  );
}
