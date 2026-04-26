import {
  Activity,
  AlertOctagon,
  ArrowRight,
  BrainCircuit,
  CircleDollarSign,
  Droplets,
  Fuel,
  Gauge,
  PauseCircle,
  RefreshCw,
  Siren,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ----------------------------- Helpers visuais ----------------------------- */

export const formatCurrencyBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const safeText = (value: unknown, fallback = "—") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  const text = String(value).trim();
  return text.length === 0 ? fallback : text;
};

/* --------------------------- Risk level executivo -------------------------- */

export type RiskLevel = "low" | "medium" | "high" | "critical";

const riskMeta: Record<RiskLevel, { label: string; tone: string; ringClass: string; barClass: string; pct: number }>= {
  low: { label: "Baixo", tone: "text-success", ringClass: "border-success/40 bg-success/10", barClass: "bg-success", pct: 25 },
  medium: { label: "Médio", tone: "text-warning", ringClass: "border-warning/40 bg-warning/10", barClass: "bg-warning", pct: 55 },
  high: { label: "Alto", tone: "text-destructive", ringClass: "border-destructive/40 bg-destructive/10", barClass: "bg-destructive", pct: 80 },
  critical: { label: "Crítico", tone: "text-destructive", ringClass: "border-destructive/60 bg-destructive/15", barClass: "bg-destructive", pct: 100 },
};

/* --------------------------- Hero executivo (KPI) -------------------------- */

export interface ExecutiveKpi {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: "critical" | "warning" | "ok" | "neutral";
  icon: typeof Truck;
  onClick?: () => void;
}

const kpiToneText: Record<ExecutiveKpi["tone"], string> = {
  critical: "text-destructive",
  warning: "text-warning",
  ok: "text-success",
  neutral: "text-foreground",
};

const kpiToneBadge: Record<ExecutiveKpi["tone"], string> = {
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  ok: "border-success/30 bg-success/10 text-success",
  neutral: "border-border bg-secondary/40 text-muted-foreground",
};

export function ExecutiveHeroPanel({
  title,
  dateLabel,
  riskLevel,
  riskHeadline,
  monthlyCost,
  estimatedDailyLoss,
  kpis,
  onRefresh,
  onSignOut,
  refreshing,
  onPrimaryAction,
}: {
  title: string;
  dateLabel: string;
  riskLevel: RiskLevel;
  riskHeadline: string;
  monthlyCost: number;
  estimatedDailyLoss: number;
  kpis: ExecutiveKpi[];
  onRefresh: () => void;
  onSignOut: () => void;
  refreshing: boolean;
  onPrimaryAction?: { label: string; onClick: () => void };
}) {
  const meta = riskMeta[riskLevel];

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-primary text-primary-foreground shadow-strong">
      <div className="relative px-4 py-5 sm:px-6 sm:py-6">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 0%, white 0%, transparent 50%)" }} aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
              <Sparkles className="h-3.5 w-3.5" /> Centro de comando — frota pesada
            </span>
            <div>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl">{title}</h1>
              <p className="mt-1 text-sm capitalize text-white/80">{dateLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onPrimaryAction && (
              <Button size="sm" onClick={onPrimaryAction.onClick} className="bg-white text-primary hover:bg-white/90">
                {onPrimaryAction.label}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing} className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Atualizando" : "Atualizar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onSignOut} className="text-white/90 hover:bg-white/10 hover:text-white">
              Sair
            </Button>
          </div>
        </div>

        {/* Risco geral + cabeçalho financeiro */}
        <div className="relative mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">Risco geral da frota</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${meta.ringClass} ${meta.tone}`}>{meta.label}</span>
            </div>
            <p className="mt-2 text-base font-semibold leading-snug">{riskHeadline}</p>
            <div className="mt-3 h-2 rounded-full bg-white/20">
              <div className={`h-2 rounded-full ${meta.barClass}`} style={{ width: `${meta.pct}%` }} />
            </div>
          </div>

          <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/80">
              <CircleDollarSign className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Custo estimado do mês</span>
            </div>
            <p className="mt-2 text-2xl font-black sm:text-3xl">{formatCurrencyBRL(monthlyCost)}</p>
            <p className="mt-1 text-xs text-white/70">Combustível + OS encerradas. Estimativa operacional.</p>
          </div>

          <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/80">
              <TrendingDown className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Perda estimada por paradas</span>
            </div>
            <p className="mt-2 text-2xl font-black sm:text-3xl">{formatCurrencyBRL(estimatedDailyLoss)}</p>
            <p className="mt-1 text-xs text-white/70">Por dia, considerando equipamentos parados agora.</p>
          </div>
        </div>
      </div>

      {/* KPIs executivos */}
      <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4 lg:grid-cols-6">
        {kpis.map((item) => {
          const Icon = item.icon;
          const Comp: any = item.onClick ? "button" : "div";
          return (
            <Comp
              key={item.id}
              type={item.onClick ? "button" : undefined}
              onClick={item.onClick}
              className="group bg-card px-3 py-4 text-left transition-colors hover:bg-secondary/40 sm:px-4"
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <Badge variant="outline" className={kpiToneBadge[item.tone]}>
                  {item.tone === "critical" ? "Crítico" : item.tone === "warning" ? "Atenção" : item.tone === "ok" ? "OK" : "—"}
                </Badge>
              </div>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className={`mt-1 text-2xl font-black leading-tight sm:text-[26px] ${kpiToneText[item.tone]}`}>{item.value}</p>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.helper}</p>
            </Comp>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------------- Diagnóstico automático (auto) ---------------------- */

export interface AutoDiagnosticData {
  riskLevel: RiskLevel;
  riskTitle: string;
  mainCause: string;
  recommendedAction: string;
  nextStep: string;
  financialImpact: number;
  evidence: string[];
}

export function AutoDiagnosticPanel({
  data,
  onPrimaryAction,
  onAiBoost,
  aiAvailable,
  aiLoading,
}: {
  data: AutoDiagnosticData;
  onPrimaryAction: () => void;
  onAiBoost?: () => void;
  aiAvailable?: boolean;
  aiLoading?: boolean;
}) {
  const meta = riskMeta[data.riskLevel];

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-black text-foreground">Diagnóstico automático da operação</CardTitle>
              <Badge variant="outline" className={`${meta.ringClass} ${meta.tone}`}>
                Risco {meta.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Avaliação contínua, gerada localmente a partir dos dados ao vivo da operação.
            </p>
          </div>
          {onAiBoost && (
            <Button size="sm" variant="outline" onClick={onAiBoost} disabled={aiLoading || !aiAvailable}>
              <Sparkles className={`mr-1 h-4 w-4 ${aiLoading ? "animate-pulse" : ""}`} />
              {aiLoading ? "Analisando" : "Aprofundar com IA"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-base font-bold text-foreground">{safeText(data.riskTitle, "Frota dentro dos parâmetros monitorados")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{safeText(data.mainCause, "Sem causas críticas identificadas neste momento.")}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Siren className="h-3.5 w-3.5 text-destructive" /> Ação recomendada agora
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{safeText(data.recommendedAction, "Manter monitoramento padrão.")}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5 text-warning" /> Impacto financeiro estimado
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {data.financialImpact > 0 ? formatCurrencyBRL(data.financialImpact) : "Sem impacto financeiro relevante"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Estimativa operacional. Não substitui controladoria.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5 text-primary" /> Próximo passo
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{safeText(data.nextStep, "Acompanhar evolução nas próximas horas.")}</p>
          </div>
        </div>

        {data.evidence.length > 0 && (
          <div className="rounded-xl border border-border bg-secondary/20 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Evidências consideradas</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {data.evidence.slice(0, 4).map((line, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button onClick={onPrimaryAction} className="h-11 w-full justify-between sm:w-auto">
          <span className="inline-flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Resolver agora
          </span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

/* ----------------------- Prioridade Agora (premium) ----------------------- */

export interface PriorityNowExecutiveItem {
  id: string;
  rank: number;
  status: "Urgente" | "Aguardando" | "Atenção" | "Em execução";
  equipment: string;
  problem: string;
  operationalImpact: string;
  downtimeOrRisk: string;
  financialImpact: number;
  responsible: string | null;
  actionLabel: string;
  onAction: () => void;
  tone: "critical" | "warning" | "action";
}

const statusBadge: Record<PriorityNowExecutiveItem["status"], string> = {
  "Urgente": "border-destructive/40 bg-destructive/10 text-destructive",
  "Aguardando": "border-warning/40 bg-warning/10 text-warning",
  "Atenção": "border-warning/30 bg-warning/10 text-warning",
  "Em execução": "border-primary/30 bg-primary/10 text-primary",
};

export function PriorityDispatchSection({ items }: { items: PriorityNowExecutiveItem[] }) {
  return (
    <section className="space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-base font-black text-foreground">Prioridade Agora</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Painel de despacho com leitura financeira e operacional para cada item da fila.</p>
        </div>
      </header>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Nenhuma prioridade ativa neste momento.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className={`h-1 w-full ${item.tone === "critical" ? "bg-destructive" : item.tone === "warning" ? "bg-warning" : "bg-primary"}`} />
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary text-sm font-black text-foreground">
                      #{item.rank}
                    </div>
                    <Badge variant="outline" className={statusBadge[item.status]}>{item.status}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Impacto financeiro</p>
                    <p className={`text-sm font-black ${item.financialImpact > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {item.financialImpact > 0 ? formatCurrencyBRL(item.financialImpact) : "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-base font-black text-foreground">{safeText(item.equipment)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{safeText(item.problem)}</p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-secondary/25 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Impacto operacional</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{safeText(item.operationalImpact)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/25 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Tempo / risco</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{safeText(item.downtimeOrRisk)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Responsável: <span className="font-semibold text-foreground">{safeText(item.responsible, "Não atribuído")}</span>
                  </p>
                  <Button size="sm" onClick={item.onAction} variant={item.tone === "critical" ? "destructive" : "default"}>
                    {item.actionLabel}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/* ----------------------------- Tanques premium ---------------------------- */

export interface PremiumTankItem {
  id: string;
  name: string;
  currentFuel: number;
  fuelCapacity: number;
  percentage: number;
  dispatchesToday: number;
  lastSupplyLabel: string;
  averageDailyConsumption: number;
}

export function PremiumTanksSection({ items, onRegisterFuel, onOpenSupply }: { items: PremiumTankItem[]; onRegisterFuel: () => void; onOpenSupply: () => void }) {
  return (
    <section className="space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <h2 className="text-base font-black text-foreground">Comboio e tanques</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Saldo, autonomia estimada e alerta de baixo nível em tempo real.</p>
        </div>
        <Button size="sm" variant="outline" onClick={onOpenSupply}>
          Reabastecer
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="p-6 text-sm text-muted-foreground">Nenhum tanque/comboio cadastrado.</CardContent>
          </Card>
        ) : (
          items.map((tank) => {
            const hasCapacity = tank.fuelCapacity > 0;
            const pct = hasCapacity ? Math.max(0, Math.min(100, tank.percentage)) : 0;
            const tone: "critical" | "warning" | "ok" = !hasCapacity || tank.currentFuel <= 0
              ? "critical"
              : pct < 20
                ? "critical"
                : pct < 50
                  ? "warning"
                  : "ok";

            const barClass = tone === "critical" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-success";
            const ringClass = tone === "critical" ? "border-destructive/30 bg-destructive/10 text-destructive"
              : tone === "warning" ? "border-warning/30 bg-warning/10 text-warning"
              : "border-success/30 bg-success/10 text-success";

            const autonomyDays = tank.averageDailyConsumption > 0 && tank.currentFuel > 0
              ? Math.floor(tank.currentFuel / tank.averageDailyConsumption)
              : null;

            const criticalEmpty = tank.currentFuel <= 0;

            return (
              <Card key={tank.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-foreground">{safeText(tank.name)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Capacidade: {hasCapacity ? `${Math.round(tank.fuelCapacity)}L` : "Não informada"}
                      </p>
                    </div>
                    <Badge variant="outline" className={ringClass}>
                      {hasCapacity ? `${pct.toFixed(0)}%` : "S/ cap."}
                    </Badge>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <p className={`text-2xl font-black ${tone === "critical" ? "text-destructive" : "text-foreground"}`}>
                        {Math.round(Math.max(tank.currentFuel, 0))}L
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {hasCapacity ? `de ${Math.round(tank.fuelCapacity)}L` : "saldo atual"}
                      </p>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-muted">
                      <div className={`h-2.5 rounded-full transition-all ${barClass}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-border bg-secondary/30 p-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Saídas hoje</p>
                      <p className="mt-0.5 text-sm font-bold text-foreground">{tank.dispatchesToday}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 p-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Última entrada</p>
                      <p className="mt-0.5 text-sm font-bold text-foreground">{safeText(tank.lastSupplyLabel, "—")}</p>
                    </div>
                  </div>

                  {criticalEmpty ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-semibold text-destructive">
                      Sem saldo registrado — necessário atualizar tanque.
                    </div>
                  ) : autonomyDays !== null ? (
                    <div className="rounded-lg border border-border bg-card p-2.5 text-xs">
                      <span className="text-muted-foreground">Autonomia estimada:</span>{" "}
                      <span className="font-bold text-foreground">{autonomyDays} dia{autonomyDays === 1 ? "" : "s"}</span>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-card p-2.5 text-xs text-muted-foreground">
                      Histórico de consumo insuficiente para autonomia.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button onClick={onRegisterFuel} className="h-11">
          <Fuel className="mr-1 h-4 w-4" /> Registrar abastecimento
        </Button>
        <Button variant="outline" onClick={onOpenSupply} className="h-11">
          <Droplets className="mr-1 h-4 w-4" /> Abrir reabastecimento
        </Button>
      </div>
    </section>
  );
}

/* ----------------------------- Resumo executivo ---------------------------- */

export interface ExecutiveSummaryData {
  situation: string;
  topRisks: string[];
  criticalEquipments: string[];
  abnormalConsumption: string[];
  overdueMaintenance: string[];
  recommendedActions: string[];
  estimatedFinancialImpact: number;
}

export function ExecutiveSummaryCard({ data, expanded, onToggle }: { data: ExecutiveSummaryData; expanded: boolean; onToggle: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-black text-foreground">Resumo executivo</CardTitle>
          </div>
          <Button size="sm" variant={expanded ? "outline" : "default"} onClick={onToggle}>
            {expanded ? "Ocultar" : "Gerar resumo executivo"}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Situação geral</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{safeText(data.situation)}</p>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Impacto financeiro estimado</p>
            <p className="mt-1 text-2xl font-black text-destructive">{formatCurrencyBRL(data.estimatedFinancialImpact)}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ExecutiveBlock title="Principais riscos" items={data.topRisks} icon={AlertOctagon} tone="critical" />
            <ExecutiveBlock title="Equipamentos críticos" items={data.criticalEquipments} icon={PauseCircle} tone="warning" />
            <ExecutiveBlock title="Consumo anormal" items={data.abnormalConsumption} icon={TrendingUp} tone="warning" />
            <ExecutiveBlock title="Manutenções vencidas" items={data.overdueMaintenance} icon={Wrench} tone="critical" />
          </div>

          <ExecutiveBlock title="Ações recomendadas" items={data.recommendedActions} icon={ArrowRight} tone="primary" />
        </CardContent>
      )}
    </Card>
  );
}

function ExecutiveBlock({ title, items, icon: Icon, tone }: { title: string; items: string[]; icon: typeof AlertOctagon; tone: "critical" | "warning" | "primary" }) {
  const accent = tone === "critical" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${accent}`} />
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sem itens identificados.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          {items.slice(0, 5).map((line, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "critical" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-primary"}`} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
