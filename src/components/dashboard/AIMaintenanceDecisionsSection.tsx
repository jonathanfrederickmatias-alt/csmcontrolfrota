import {
  Activity,
  Bot,
  CircleDollarSign,
  Clock3,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type AIMaintenanceDecision = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  summary: string;
  failureRisk: number;
  recommendation: string;
  reason: string;
  priority: "critical" | "high" | "medium" | "low";
  maintenanceType: "preventive" | "corrective";
  suggestedParts: string[];
  downtimeHours: number;
  consumptionStatus: string;
  consumptionDeviationPercent: number;
  costAnalysis: string;
  problemsIdentified: string[];
  possibleCauses: string[];
  recommendedActions: string[];
  operationalImpact?: string;
  technicalReason?: string;
  anomalyFlags?: string[];
  equipmentClassification: "good" | "medium" | "bad";
  autoCreateOS: boolean;
};

const priorityStyles: Record<AIMaintenanceDecision["priority"], string> = {
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/30 bg-warning/10 text-warning",
  low: "border-success/30 bg-success/10 text-success",
};

const maintenanceTypeLabel: Record<AIMaintenanceDecision["maintenanceType"], string> = {
  preventive: "Preventiva",
  corrective: "Corretiva",
};

const priorityLabel: Record<AIMaintenanceDecision["priority"], string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const classificationLabel: Record<AIMaintenanceDecision["equipmentClassification"], string> = {
  good: "Bom",
  medium: "Médio",
  bad: "Ruim",
};

export function AIMaintenanceDecisionsSection({
  items,
  loading,
  errorMessage,
  hasGenerated,
  creatingId,
  onRefresh,
  onCreateWorkOrder,
}: {
  items: AIMaintenanceDecision[];
  loading: boolean;
  errorMessage?: string | null;
  hasGenerated: boolean;
  creatingId?: string | null;
  onRefresh: () => void;
  onCreateWorkOrder: (item: AIMaintenanceDecision) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-base font-black text-foreground">Avaliação operacional da IA</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Diagnóstico executivo com risco, consumo, custo, anomalias e ação operacional imediata.
          </p>
        </div>
        <Button type="button" variant="outline" className="h-10 gap-2 px-4" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {hasGenerated ? "Atualizar análise" : "Gerar análise"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Processando manutenção, consumo, custos e impacto na obra...</CardContent>
          </Card>
        ) : errorMessage ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>{errorMessage}</p>
              <Button type="button" variant="outline" className="h-10 gap-2 px-4" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : !hasGenerated ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>Gere a avaliação para montar um parecer operacional objetivo, pronto para decisão e abertura de OS.</p>
              <Button type="button" className="h-10 w-full gap-2 sm:w-auto" onClick={onRefresh}>
                <Sparkles className="h-4 w-4" />
                Gerar avaliação operacional
              </Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Sem avaliações automáticas disponíveis neste momento.</CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="border-border/70 bg-card shadow-sm">
              <CardHeader className="gap-3 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-black text-foreground">{item.equipmentName}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={priorityStyles[item.priority]}>{priorityLabel[item.priority]}</Badge>
                    <Badge variant="outline">{maintenanceTypeLabel[item.maintenanceType]}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-border bg-secondary/25 p-3">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Risco de falha</span>
                    </div>
                    <p className="text-lg font-black text-foreground">{item.failureRisk}/100</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/25 p-3">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <Activity className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Consumo</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{item.consumptionStatus}</p>
                    <p className="text-xs text-muted-foreground">Desvio de {item.consumptionDeviationPercent.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/25 p-3">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <Gauge className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Classificação</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{classificationLabel[item.equipmentClassification]}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/25 p-3 text-muted-foreground">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <Clock3 className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Parada</span>
                    </div>
                    <p>{item.downtimeHours.toFixed(1)} h</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
                  <div className="mb-2 flex items-center gap-2 text-foreground">
                    <TriangleAlert className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Resumo geral</span>
                  </div>
                  <p className="font-medium text-foreground">{item.recommendation}</p>
                  <p className="mt-2">{item.technicalReason || item.reason}</p>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm lg:grid-cols-3 lg:items-start">
                  <div className="rounded-lg bg-secondary/30 p-3">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <TriangleAlert className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Problemas identificados</span>
                    </div>
                    <ul className="space-y-1 text-muted-foreground">
                      {(item.problemsIdentified.length > 0 ? item.problemsIdentified : ["Sem problemas críticos listados."]).map((problem, index) => (
                        <li key={`${item.id}-problem-${index}`}>• {problem}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-3">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Possíveis causas</span>
                    </div>
                    <ul className="space-y-1 text-muted-foreground">
                      {(item.possibleCauses.length > 0 ? item.possibleCauses : ["Sem causas prováveis detalhadas."]).map((cause, index) => (
                        <li key={`${item.id}-cause-${index}`}>• {cause}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-3">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Ações recomendadas</span>
                    </div>
                    <ul className="space-y-1 text-muted-foreground">
                      {(item.recommendedActions.length > 0 ? item.recommendedActions : ["Sem ação adicional sugerida."]).map((action, index) => (
                        <li key={`${item.id}-action-${index}`}>• {action}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm lg:grid-cols-3 lg:items-start">
                  <div className="rounded-lg bg-secondary/30 p-3 text-muted-foreground">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <CircleDollarSign className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Custo</span>
                    </div>
                    <p>{item.costAnalysis}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-3 text-muted-foreground">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <Wrench className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Peças sugeridas</span>
                    </div>
                    <p>{item.suggestedParts.length > 0 ? item.suggestedParts.join(", ") : "Sem sugestão específica de peças."}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-3 text-muted-foreground">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <CircleDollarSign className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Impacto na operação</span>
                    </div>
                    <p>{item.operationalImpact || "Sem impacto adicional informado."}</p>
                  </div>
                </div>

                {item.anomalyFlags && item.anomalyFlags.length > 0 ? (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                    <span className="font-semibold">Anomalias detectadas:</span> {item.anomalyFlags.join(" · ")}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Tomada de decisão: <span className="font-semibold text-foreground">{item.recommendation}</span>
                  </p>

                  <Button
                    onClick={() => onCreateWorkOrder(item)}
                    className="h-11 w-full justify-between px-4 sm:w-auto"
                    variant={item.priority === "critical" || item.priority === "high" ? "destructive" : "default"}
                    disabled={creatingId === item.id || !item.autoCreateOS}
                  >
                    <span className="inline-flex items-center gap-2"><Wrench className="h-4 w-4" />
                    {creatingId === item.id ? "Criando OS..." : item.autoCreateOS ? "Gerar OS agora" : "Ação indisponível"}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}