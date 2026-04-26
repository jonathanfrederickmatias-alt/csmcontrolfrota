import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Droplets,
  Fuel,
  PauseCircle,
  ShieldAlert,
  TimerReset,
  Truck,
  Wrench,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export interface DashboardQuickAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export interface ActionableAlertItem {
  id: string;
  label: string;
  value: number;
  description: string;
  icon: typeof AlertTriangle;
  tone: "critical" | "warning" | "ok";
  actions: DashboardQuickAction[];
}

export interface PriorityRankingItem {
  id: string;
  title: string;
  description: string;
  priority: "p1" | "p2" | "p3";
  priorityLabel: string;
  onClick: () => void;
}

export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  tone: "critical" | "warning" | "ok";
  actionLabel: string;
  onClick: () => void;
}

export interface ConsumptionTrendPoint {
  label: string;
  current: number;
  average: number;
}

export interface ConsumptionDetailedItem {
  id: string;
  equipmentName: string;
  variationPercent: number;
  metricLabel: string;
  severity: "warning" | "critical";
  currentMetric: number;
  averageMetric: number;
  unit: string;
  points: ConsumptionTrendPoint[];
}

export interface FuelOpsItem {
  id: string;
  name: string;
  currentFuel: number;
  fuelCapacity: number;
  percentage: number;
  dispatchesToday: number;
  lastSupplyLabel: string;
  lowLevelThreshold: number;
}

const toneSurfaceClasses: Record<ActionableAlertItem["tone"] | RecommendationItem["tone"], string> = {
  critical: "border-destructive/30 bg-destructive/10",
  warning: "border-warning/30 bg-warning/10",
  ok: "border-success/30 bg-success/10",
};

const toneTextClasses: Record<ActionableAlertItem["tone"] | RecommendationItem["tone"], string> = {
  critical: "text-destructive",
  warning: "text-warning",
  ok: "text-success",
};

const priorityClasses: Record<PriorityRankingItem["priority"], string> = {
  p1: "border-destructive/30 bg-destructive/10 text-destructive",
  p2: "border-warning/30 bg-warning/10 text-warning",
  p3: "border-primary/20 bg-primary/10 text-primary",
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
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <Button variant="ghost" size="sm" onClick={onAction} className="h-8 shrink-0 px-2 text-xs">
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

export function ActionableAlertsPanel({ items }: { items: ActionableAlertItem[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader
        icon={ShieldAlert}
        title="Alertas que viram ação"
        description="Cada alerta já traz o próximo passo operacional sem exigir leitura adicional."
      />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.id} className={toneSurfaceClasses[item.tone]}>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${toneTextClasses[item.tone]}`} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    </div>
                    <p className={`text-3xl font-black ${toneTextClasses[item.tone]}`}>{item.value}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {item.actions.map((action) => (
                    <Button key={action.label} variant={action.variant ?? "outline"} size="sm" onClick={action.onClick} className="w-full">
                      {action.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function PriorityRankingSection({ items }: { items: PriorityRankingItem[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader
        icon={AlertTriangle}
        title="Top 5 problemas mais urgentes"
        description="Ranking automático por impacto operacional: parada crítica, consumo fora da curva e manutenção vencida."
      />
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum problema urgente classificado neste momento.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-secondary/30"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary/50 text-sm font-black text-foreground">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{item.title}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${priorityClasses[item.priority]}`}>
                        {item.priorityLabel}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function RecommendedActionsSection({ items }: { items: RecommendationItem[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader
        icon={ClipboardCheck}
        title="Ações recomendadas hoje"
        description="Sequência sugerida para o operador destravar a operação com menos análise manual."
      />
      <div className="grid grid-cols-1 gap-3">
        {items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Sem recomendações pendentes para hoje.</CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className={toneSurfaceClasses[item.tone]}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Button variant={item.tone === "critical" ? "destructive" : "outline"} size="sm" onClick={item.onClick} className="w-full sm:w-auto">
                  {item.actionLabel}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}

const chartConfig = {
  current: {
    label: "Atual",
    color: "hsl(var(--destructive))",
  },
  average: {
    label: "Média",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function ConsumptionOperationsSection({
  items,
  onOpenReports,
}: {
  items: ConsumptionDetailedItem[];
  onOpenReports: () => void;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        icon={Fuel}
        title="Consumo inteligente"
        description="Leitura operacional com base histórica validada, unidade correta e alerta reforçado acima de 30% de desvio."
        actionLabel="Abrir relatórios"
        onAction={onOpenReports}
      />
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Nenhum consumo fora do padrão identificado.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-black">Evolução do principal desvio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold text-foreground">{items[0].equipmentName}</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${items[0].severity === "critical" ? toneSurfaceClasses.critical + " " + toneTextClasses.critical : toneSurfaceClasses.warning + " " + toneTextClasses.warning}`}>
                  {items[0].variationPercent.toFixed(0)}% de desvio
                </span>
              </div>
              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <LineChart data={items[0].points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(value) => Number(value).toFixed(1)} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="average" stroke="var(--color-average)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="current" stroke="var(--color-current)" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ChartContainer>
              <p className="text-sm text-muted-foreground">{items[0].metricLabel}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">{item.equipmentName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.metricLabel}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${item.severity === "critical" ? toneSurfaceClasses.critical + " " + toneTextClasses.critical : toneSurfaceClasses.warning + " " + toneTextClasses.warning}`}>
                        {item.variationPercent.toFixed(0)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="rounded-lg bg-secondary/40 p-2">
                        <span className="block">Atual</span>
                        <strong className="text-sm text-foreground">{item.currentMetric.toFixed(2)} {item.unit}</strong>
                      </div>
                      <div className="rounded-lg bg-secondary/40 p-2">
                        <span className="block">Histórico</span>
                        <strong className="text-sm text-foreground">{item.averageMetric.toFixed(2)} {item.unit}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}

export function FuelOperationsSection({ items, onRegisterFuel, onOpenSupply }: { items: FuelOpsItem[]; onRegisterFuel: () => void; onOpenSupply: () => void }) {
  return (
    <section className="space-y-3">
      <SectionHeader
        icon={Droplets}
        title="Comboio e tanques"
        description="Saldo real, giro diário e alerta de nível baixo para manter a frente operacional abastecida."
        actionLabel="Registrar abastecimento"
        onAction={onRegisterFuel}
      />
      <Card>
        <CardContent className="space-y-3 p-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum tanque/comboio cadastrado.</p>
          ) : (
            items.map((item) => {
              const isCritical = item.currentFuel <= item.lowLevelThreshold;
              const tone = isCritical ? "critical" : item.percentage <= 30 ? "warning" : "ok";

              return (
                <div key={item.id} className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Último reabastecimento: {item.lastSupplyLabel}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${toneSurfaceClasses[tone]} ${toneTextClasses[tone]}`}>
                      {Math.round(item.currentFuel)}L / {Math.round(item.fuelCapacity)}L
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${tone === "critical" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-success"}`}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded-lg bg-background/70 p-2">
                      <span className="block">Saídas hoje</span>
                      <strong className="text-sm text-foreground">{item.dispatchesToday}</strong>
                    </div>
                    <div className="rounded-lg bg-background/70 p-2">
                      <span className="block">Alerta baixo nível</span>
                      <strong className={`text-sm ${isCritical ? "text-destructive" : "text-foreground"}`}>{Math.round(item.lowLevelThreshold)}L</strong>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={onRegisterFuel}>Registrar abastecimento</Button>
            <Button variant="outline" onClick={onOpenSupply}>Abrir reabastecimento</Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function MaintenanceOperationsHeader({ onOpenAll }: { onOpenAll: () => void }) {
  return (
    <SectionHeader
      icon={TimerReset}
      title="Manutenção preventiva"
      description="Fila operacional priorizada por atraso, proximidade e disponibilidade para abertura de OS."
      actionLabel="Ver manutenção"
      onAction={onOpenAll}
    />
  );
}

export function WorkOrdersHeader() {
  return <SectionHeader icon={Wrench} title="Ordens de serviço" description="Volume, criticidade e gargalos para despacho da oficina." />;
}

export function EquipmentStatusHeader() {
  return <SectionHeader icon={PauseCircle} title="Equipamentos e disponibilidade" description="Leitura de parada operacional e impacto na frente de obra." />;
}
