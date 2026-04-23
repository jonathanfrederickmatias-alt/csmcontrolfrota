import { Bot, CircleDollarSign, Clock3, Sparkles, TriangleAlert, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type AIMaintenanceDecision = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  recommendation: string;
  reason: string;
  priority: "high" | "medium" | "low";
  maintenanceType: "preventive" | "corrective";
  suggestedParts: string[];
  downtimeHours: number;
  operationalImpact?: string;
  technicalReason?: string;
  autoCreateOS: boolean;
};

const priorityStyles: Record<AIMaintenanceDecision["priority"], string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/30 bg-warning/10 text-warning",
  low: "border-success/30 bg-success/10 text-success",
};

const maintenanceTypeLabel: Record<AIMaintenanceDecision["maintenanceType"], string> = {
  preventive: "Preventiva",
  corrective: "Corretiva",
};

const priorityLabel: Record<AIMaintenanceDecision["priority"], string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export function AIMaintenanceDecisionsSection({
  items,
  loading,
  creatingId,
  onCreateWorkOrder,
}: {
  items: AIMaintenanceDecision[];
  loading: boolean;
  creatingId?: string | null;
  onCreateWorkOrder: (item: AIMaintenanceDecision) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-base font-black text-foreground">Decisões automáticas da IA</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Recomendações operacionais geradas com base em manutenção, falhas, consumo e criticidade do ativo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Analisando sinais operacionais para gerar decisões automáticas...</CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Sem decisões automáticas disponíveis neste momento.</CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="border-border/70 bg-card shadow-sm">
              <CardHeader className="gap-3 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-black text-foreground">{item.equipmentName}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{item.recommendation}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={priorityStyles[item.priority]}>{priorityLabel[item.priority]}</Badge>
                    <Badge variant="outline">{maintenanceTypeLabel[item.maintenanceType]}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
                  <div className="mb-2 flex items-center gap-2 text-foreground">
                    <TriangleAlert className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Motivo técnico</span>
                  </div>
                  {item.technicalReason || item.reason}
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
                  <div className="rounded-lg bg-secondary/30 p-3">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Peças sugeridas</span>
                    </div>
                    <p className="text-muted-foreground">
                      {item.suggestedParts.length > 0 ? item.suggestedParts.join(", ") : "Sem sugestão específica de peças."}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-3 text-muted-foreground">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <CircleDollarSign className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Impacto na operação</span>
                    </div>
                    <p>{item.operationalImpact || "Sem impacto adicional informado."}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-3 text-muted-foreground sm:min-w-[140px]">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <Clock3 className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Parada</span>
                    </div>
                    <p>{item.downtimeHours.toFixed(1)} h</p>
                  </div>
                </div>

                <Button
                  onClick={() => onCreateWorkOrder(item)}
                  className="h-11 w-full justify-between px-4 sm:w-auto"
                  variant={item.priority === "high" ? "destructive" : "default"}
                  disabled={creatingId === item.id || !item.autoCreateOS}
                >
                  <span className="inline-flex items-center gap-2"><Wrench className="h-4 w-4" />
                  {creatingId === item.id ? "Criando OS..." : item.autoCreateOS ? "Criar OS automaticamente" : "Ação indisponível"}
                  </span>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}