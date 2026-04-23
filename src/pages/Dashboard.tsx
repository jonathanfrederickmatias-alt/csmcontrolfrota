import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, PauseCircle, Truck, Wrench } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateMaintenanceStatus } from "@/lib/maintenance-utils";
import {
  ChecklistOverviewItem,
  DashboardHero,
  DashboardKpiItem,
  EmptyOperationalState,
  KpiSummaryGrid,
  MaintenancePriorityItem,
  MaintenancePriorityList,
  ChecklistOverviewSection,
  WorkOrdersOperationalBlock,
  WorkOrderStatusItem,
} from "@/components/dashboard/OperationalDashboardSections";
import {
  ActionableAlertItem,
  ActionableAlertsPanel,
  ConsumptionDetailedItem,
  ConsumptionOperationsSection,
  EquipmentAnomaliesSection,
  EquipmentAnomalyItem,
  FuelOperationsSection,
  FuelOpsItem,
  PriorityRankingItem,
  PriorityRankingSection,
  RecommendationItem,
  RecommendedActionsSection,
} from "@/components/dashboard/OperationalCommandCenterSections";
import {
  AIMaintenanceDecision,
  AIMaintenanceDecisionsSection,
} from "@/components/dashboard/AIMaintenanceDecisionsSection";
import {
  OperationalCommandDeck,
  PriorityNowSection,
  type ExecutiveSignalItem,
  type PriorityNowItem,
  type QuickActionItem,
} from "@/components/dashboard/PremiumOperationsSections";
import { Camera, MessageSquare, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type DashboardData = {
  equipments: any[];
  checklists: any[];
  plans: any[];
  fuelRecords: any[];
  fuelPriceSettings: any[];
  fuelSupplyRecords: any[];
  requests: any[];
  combos: any[];
  workOrders: any[];
  maintenanceHistory: any[];
};

type EfficiencySegment = {
  label: string;
  metric: number;
};

type FuelMetricRecord = {
  date: string;
  created_at: string;
  hour_meter: number;
  liters: number;
};

type EquipmentAnomalyType = "hourmeter" | "consumption" | "data";

type EquipmentAnomalySummary = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  severity: "critical" | "warning";
  anomalyTypes: EquipmentAnomalyType[];
  summary: string;
  detail: string;
  impact: string;
  blocksAutoOs: boolean;
};

type MaintenanceStatus = "ok" | "approaching" | "overdue";

type MaintenanceListItem = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  currentHourMeter: number;
  status: MaintenanceStatus;
  remaining: number;
  unit: string;
  planLabel: string;
};

type StatsSummary = {
  todayChecklists: any[];
  checklistCounts: { ok: number; attention: number; critical: number };
  maintenanceItems: any[];
  overdueMaintenance: any[];
  approachingMaintenance: any[];
  activeOrders: any[];
  criticalOrders: any[];
  waitingPartsOrders: any[];
  stoppedEquipments: any[];
  consumptionInsights: ConsumptionDetailedItem[];
  anomalies: EquipmentAnomalySummary[];
  openRequests: number;
  inProgressRequests: number;
  activeEquipments: number;
  priorityRanking: PriorityRankingItem[];
  recommendations: RecommendationItem[];
  lowFuelCombos: any[];
  monthlyCost: number;
};

type AIMaintenanceDecisionPayload = AIMaintenanceDecision;

const priorityWeights: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function getPlanUnit(type?: string) {
  return type === "truck" ? "km" : "h";
}

function formatPlanTiming(remaining: number, unit: string, status: "ok" | "approaching" | "overdue") {
  if (status === "overdue") return `${Math.abs(Math.round(remaining))} ${unit} de atraso`;
  if (status === "approaching") return `Faltam ${Math.max(Math.round(remaining), 0)} ${unit}`;
  return `Próxima em ${Math.max(Math.round(remaining), 0)} ${unit}`;
}

function inferWaitingParts(order: any) {
  const text = `${order?.notes || ""} ${order?.service_executed || ""}`.toLowerCase();
  return /(aguardando peça|aguardando peca|peça pendente|peca pendente|falta peça|falta peca)/.test(text);
}

function formatDateLabel(value?: string | null) {
  if (!value) return "sem registro";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "sem registro";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isRealisticMetric(type: "truck" | "equipment", metric: number) {
  if (!Number.isFinite(metric) || metric <= 0) return false;
  if (type === "truck") return metric >= 0.5 && metric <= 6.5;
  return metric >= 0.5 && metric <= 80;
}

function buildSystemSummary({
  overdueCount,
  abnormalCount,
  openOrders,
  criticalOrders,
  stoppedCount,
  recommendedCount,
}: {
  overdueCount: number;
  abnormalCount: number;
  openOrders: number;
  criticalOrders: number;
  stoppedCount: number;
  recommendedCount: number;
}) {
  const segments = [
    `${overdueCount} equipamento${overdueCount === 1 ? "" : "s"} com manutenção atrasada`,
    `${abnormalCount} com consumo acima do normal`,
    `${openOrders} ordem${openOrders === 1 ? "" : "ens"} de serviço em aberto`,
  ];

  if (criticalOrders > 0) {
    segments.push(`${criticalOrders} OS crítica${criticalOrders === 1 ? "" : "s"}`);
  }

  if (stoppedCount > 0) {
    segments.push(`${stoppedCount} equipamento${stoppedCount === 1 ? "" : "s"} parado${stoppedCount === 1 ? "" : "s"}`);
  }

  return `Hoje existem ${segments.join(", ")} e ${recommendedCount} ação${recommendedCount === 1 ? "" : "ões"} recomendada${recommendedCount === 1 ? "" : "s"} para o turno.`;
}

function getConsumptionVariation(type: "truck" | "equipment", currentMetric: number, averageMetric: number) {
  if (!averageMetric) return 0;
  return type === "truck"
    ? ((averageMetric - currentMetric) / averageMetric) * 100
    : ((currentMetric - averageMetric) / averageMetric) * 100;
}

function getPriorityDescriptor(priority: string) {
  if (priority === "urgent" || priority === "high") return "Crítica";
  if (priority === "medium") return "Alta atenção";
  return "Monitorar";
}

function getEquipmentDisplayName(equipment?: {
  name?: string | null;
  plate?: string | null;
  cost_center?: string | null;
  chassis?: string | null;
}) {
  if (!equipment) return "Equipamento sem identificação";
  const baseName = String(equipment.name || "Equipamento sem identificação").trim();
  const identifier = [equipment.cost_center, equipment.plate, equipment.chassis]
    .map((value) => String(value || "").trim())
    .find(Boolean);

  return identifier ? `${baseName} (${identifier})` : baseName;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [data, setData] = useState<DashboardData>({
    equipments: [],
    checklists: [],
    plans: [],
    fuelRecords: [],
    fuelPriceSettings: [],
    fuelSupplyRecords: [],
    requests: [],
    combos: [],
    workOrders: [],
    maintenanceHistory: [],
  });
  const [aiDecisions, setAiDecisions] = useState<AIMaintenanceDecisionPayload[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [aiHasGenerated, setAiHasGenerated] = useState(false);
  const [creatingAiDecisionId, setCreatingAiDecisionId] = useState<string | null>(null);
  const [anomalyFilter, setAnomalyFilter] = useState<"all" | "blocked" | "hourmeter" | "consumption">("all");

  useEffect(() => {
    if (location.search.includes('focus=ai')) {
      requestAnimationFrame(() => {
        document.getElementById('ai-operacional-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.search]);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    const today = new Date();
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(today.getDate() - 60);
    const cutoffDate = sixtyDaysAgo.toISOString().split("T")[0];

    const [eqRes, clRes, plRes, frRes, fpsRes, fsRes, reqRes, woRes, histRes] = await Promise.all([
      supabase.from("equipments").select("*"),
      supabase.from("checklists").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("maintenance_plans").select("*"),
      supabase.from("fuel_records").select("*").gte("date", cutoffDate).order("date", { ascending: false }).limit(1000),
      supabase.from("fuel_price_settings").select("*"),
      supabase.from("fuel_supply_records").select("*").gte("date", cutoffDate).order("date", { ascending: false }).limit(300),
      supabase.from("maintenance_requests").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("work_orders").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("maintenance_history").select("*").order("executed_at", { ascending: false }).limit(300),
    ]);

    const equipments = eqRes.data || [];
    setData({
      equipments,
      checklists: clRes.data || [],
      plans: plRes.data || [],
      fuelRecords: frRes.data || [],
      fuelPriceSettings: fpsRes.data || [],
      fuelSupplyRecords: fsRes.data || [],
      requests: reqRes.data || [],
      combos: equipments.filter((equipment: any) => equipment.type === "combo"),
      workOrders: woRes.data || [],
      maintenanceHistory: histRes.data || [],
    });
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadAiDecisions = useCallback(async () => {
    if (data.equipments.length === 0) {
      setAiDecisions([]);
      setAiHasGenerated(true);
      setAiErrorMessage(null);
      return;
    }

    setAiLoading(true);
    setAiErrorMessage(null);
    setAiHasGenerated(true);

    const { data: response, error } = await supabase.functions.invoke("maintenance-ai-decisions", {
      body: {
        equipments: data.equipments,
        maintenancePlans: data.plans,
        maintenanceHistory: data.maintenanceHistory,
        fuelRecords: data.fuelRecords,
        workOrders: data.workOrders,
      },
    });

    const backendErrorMessage = typeof response?.userMessage === "string"
      ? response.userMessage
      : typeof response?.error === "string" && (response.error.includes("payment_required") || response.error.includes("Not enough credits"))
        ? "A análise operacional está temporariamente indisponível porque o crédito de IA do workspace acabou. Recarregue os créditos para gerar novas avaliações."
        : typeof response?.error === "string" && response.error.includes("rate_limit")
          ? "A análise operacional atingiu o limite momentâneo de requisições. Aguarde alguns instantes e tente novamente."
          : null;

    if (error || backendErrorMessage) {
      const friendlyMessage = backendErrorMessage || (error?.message.includes("payment_required") || error?.message.includes("Not enough credits")
        ? "A análise operacional está temporariamente indisponível porque o crédito de IA do workspace acabou. Recarregue os créditos para gerar novas avaliações."
        : "Não foi possível gerar a avaliação operacional agora.");
      setAiDecisions([]);
      setAiErrorMessage(friendlyMessage);
      toast({ title: "Análise operacional indisponível", description: friendlyMessage, variant: "destructive" });
      setAiLoading(false);
      return;
    }

    const items = Array.isArray(response?.decisions) ? response.decisions : [];
    setAiDecisions(
      items
        .filter((item: any) => item?.equipmentId && item?.recommendation)
        .map((item: any) => {
          const equipment = data.equipments.find((entry: any) => entry.id === item.equipmentId);
          const priority = item.priority === "critical" || item.priority === "high" || item.priority === "medium" || item.priority === "low" ? item.priority : "medium";
          const classification = item.equipmentClassification === "good" || item.equipmentClassification === "medium" || item.equipmentClassification === "bad" ? item.equipmentClassification : "medium";
          return {
            id: `${item.equipmentId}-${priority}-${item.maintenanceType}`,
            equipmentId: item.equipmentId,
            equipmentName: getEquipmentDisplayName(equipment),
            summary: item.summary || item.reason || item.recommendation,
            failureRisk: Math.max(0, Math.min(100, Number(item.failureRisk || 0))),
            recommendation: item.recommendation,
            reason: item.reason || "Sem justificativa detalhada.",
            priority,
            maintenanceType: item.maintenanceType === "corrective" ? "corrective" : "preventive",
            suggestedParts: Array.isArray(item.suggestedParts) ? item.suggestedParts.filter(Boolean) : [],
            downtimeHours: Number(item.downtimeHours || 0),
            consumptionStatus: item.consumptionStatus || "Dentro do esperado",
            consumptionDeviationPercent: Number(item.consumptionDeviationPercent || 0),
            costAnalysis: item.costAnalysis || "Sem pressão financeira relevante no momento.",
            problemsIdentified: Array.isArray(item.problemsIdentified) ? item.problemsIdentified.filter(Boolean) : [],
            possibleCauses: Array.isArray(item.possibleCauses) ? item.possibleCauses.filter(Boolean) : [],
            recommendedActions: Array.isArray(item.recommendedActions) ? item.recommendedActions.filter(Boolean) : [item.recommendation],
            operationalImpact: item.operationalImpact || `Impacto estimado de ${Number(item.downtimeHours || 0).toFixed(1)}h na disponibilidade operacional.`,
            technicalReason: item.technicalReason || item.reason || "Sem justificativa detalhada.",
            anomalyFlags: Array.isArray(item.anomalyFlags) ? item.anomalyFlags.filter(Boolean) : [],
            equipmentClassification: classification,
            autoCreateOS: item.autoCreateOS !== false,
          } satisfies AIMaintenanceDecisionPayload;
        })
        .slice(0, 5),
    );
    setAiLoading(false);
  }, [data.equipments, data.fuelRecords, data.maintenanceHistory, data.plans, data.workOrders]);

  const handleCreateAiWorkOrder = useCallback(async (item: AIMaintenanceDecisionPayload) => {
    if (item.anomalyFlags && item.anomalyFlags.length > 0) {
      toast({
        title: "OS automática bloqueada",
        description: "Corrija as inconsistências de horímetro/consumo antes de gerar a OS automática para este equipamento.",
        variant: "destructive",
      });
      setCreatingAiDecisionId(null);
      return;
    }

    setCreatingAiDecisionId(item.id);

    const mappedPriority = item.priority === "high" ? "urgent" : item.priority === "medium" ? "high" : "medium";
    const description = `${item.recommendation}${item.suggestedParts.length > 0 ? ` | Peças sugeridas: ${item.suggestedParts.join(", ")}` : ""}${item.downtimeHours > 0 ? ` | Parada estimada: ${item.downtimeHours.toFixed(1)}h` : ""}`;

    const { data: requestData, error: requestError } = await supabase
      .from("maintenance_requests")
      .insert({
        equipment_id: item.equipmentId,
        description,
        priority: mappedPriority,
        operator_name: "IA Operacional",
        status: "open",
        notes: item.reason,
      })
      .select()
      .single();

    if (requestError || !requestData) {
      toast({ title: "Erro ao criar pedido automático", description: requestError?.message, variant: "destructive" });
      setCreatingAiDecisionId(null);
      return;
    }

    const { error: workOrderError } = await supabase.from("work_orders").insert({
      equipment_id: item.equipmentId,
      maintenance_request_id: requestData.id,
      description,
      priority: mappedPriority,
      status: "open",
      notes: item.reason,
    });

    if (workOrderError) {
      toast({ title: "Erro ao criar OS automática", description: workOrderError.message, variant: "destructive" });
    } else {
      toast({ title: "OS automática criada", description: `${item.equipmentName} entrou na fila operacional.` });
      fetchData();
    }

    setCreatingAiDecisionId(null);
  }, [fetchData]);

  const today = new Date().toISOString().split("T")[0];
  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const equipmentMap = useMemo(
    () => Object.fromEntries(data.equipments.map((equipment: any) => [equipment.id, equipment])),
    [data.equipments],
  );

  const stats = useMemo<StatsSummary>(() => {
    const todayChecklists = data.checklists.filter((checklist: any) => checklist.date === today);
    const checklistCounts = {
      ok: data.checklists.filter((checklist: any) => checklist.status === "ok").length,
      attention: data.checklists.filter((checklist: any) => checklist.status === "attention").length,
      critical: data.checklists.filter((checklist: any) => checklist.status === "critical").length,
    };

    const maintenanceItems: MaintenanceListItem[] = data.plans
      .map((plan: any) => {
        const equipment = equipmentMap[plan.equipment_id];
        if (!equipment) return null;
        const remaining = Number(plan.next_due_at) - Number(equipment.current_hour_meter || 0);
        const status = calculateMaintenanceStatus(remaining, equipment.type);
        return {
          id: plan.id,
          equipmentId: equipment.id,
          equipmentName: getEquipmentDisplayName(equipment),
          currentHourMeter: Number(equipment.current_hour_meter || 0),
          status,
          remaining,
          unit: getPlanUnit(equipment.type),
          planLabel: `${plan.description} · meta ${Math.round(Number(plan.next_due_at) || 0)} ${getPlanUnit(equipment.type)}`,
        };
      })
      .filter((item): item is MaintenanceListItem => item !== null)
      .sort((a, b) => {
        const order = { overdue: 0, approaching: 1, ok: 2 };
        const statusDiff = order[a.status] - order[b.status];
        if (statusDiff !== 0) return statusDiff;
        return a.remaining - b.remaining;
      });

    const overdueMaintenance = maintenanceItems.filter((item) => item.status === "overdue");
    const approachingMaintenance = maintenanceItems.filter((item) => item.status === "approaching");
    const activeOrders = data.workOrders.filter((order: any) => order.status !== "done");
    const criticalOrders = activeOrders.filter((order: any) => priorityWeights[order.priority] >= priorityWeights.high);
    const waitingPartsOrders = activeOrders.filter((order: any) => inferWaitingParts(order));
    const stoppedEquipments = data.equipments.filter((equipment: any) => equipment.status !== "active");

    const fuelMetrics = data.fuelRecords.reduce((acc: Record<string, FuelMetricRecord[]>, record: any) => {
      const targetId = record.target_equipment_id;
      const hourMeter = Number(record.hour_meter || 0);
      const liters = Number(record.liters || 0);
      const fuelType = String(record.fuel_type || "").toLowerCase();
      if (!targetId || !hourMeter || liters <= 0 || fuelType === "arla") return acc;
      if (!acc[targetId]) acc[targetId] = [];
      acc[targetId].push({
        date: record.date,
        created_at: record.created_at,
        hour_meter: hourMeter,
        liters,
      });
      return acc;
    }, {});

    const consumptionInsights = (Object.entries(fuelMetrics) as Array<[string, FuelMetricRecord[]]>)
      .map(([equipmentId, records]) => {
        const equipment = equipmentMap[equipmentId];
        if (!equipment || records.length < 3) return null;

        const metricType = equipment.type === "truck" ? "truck" : "equipment";
        const sortedRecords = [...records].sort(
          (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at),
        );

        const segments = sortedRecords.reduce((acc: EfficiencySegment[], current, index) => {
          if (index === 0) return acc;
          const previous = sortedRecords[index - 1];
          const delta = current.hour_meter - previous.hour_meter;
          if (delta <= 0 || current.liters <= 0) return acc;
          const metric = metricType === "truck" ? delta / current.liters : current.liters / delta;
          if (!isRealisticMetric(metricType, metric)) return acc;
          acc.push({
            label: formatDateLabel(current.date),
            metric,
          });
          return acc;
        }, []);

        if (segments.length < 2) return null;

        const currentSegment = segments[segments.length - 1];
        const historicalSegments = segments.slice(0, -1);
        const historicalAverage = historicalSegments.reduce((sum, item) => sum + item.metric, 0) / historicalSegments.length;
        if (!historicalAverage || !isRealisticMetric(metricType, currentSegment.metric)) return null;

        const variation = getConsumptionVariation(metricType, currentSegment.metric, historicalAverage);
        if (variation <= 0) return null;

        return {
          id: equipmentId,
          equipmentName: getEquipmentDisplayName(equipment),
          variationPercent: variation,
          metricLabel: `${currentSegment.metric.toFixed(2)} ${metricType === "truck" ? "km/L" : "L/h"} frente à média histórica de ${historicalAverage.toFixed(2)} ${metricType === "truck" ? "km/L" : "L/h"}`,
          severity: variation > 30 ? "critical" : "warning",
          currentMetric: currentSegment.metric,
          averageMetric: historicalAverage,
          unit: metricType === "truck" ? "km/L" : "L/h",
          points: segments.slice(-6).map((segment) => ({
            label: segment.label,
            current: Number(segment.metric.toFixed(2)),
            average: Number(historicalAverage.toFixed(2)),
          })),
        } satisfies ConsumptionDetailedItem;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.variationPercent - a.variationPercent);

    const anomalies: EquipmentAnomalySummary[] = data.equipments
      .map((equipment: any) => {
        const relatedFuel = (fuelMetrics[equipment.id] || []).sort(
          (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at),
        );
        const relatedConsumption = consumptionInsights.find((item) => item.id === equipment.id);
        const anomalyTypes: EquipmentAnomalyType[] = [];
        const detailParts: string[] = [];
        const impactParts: string[] = [];
        let severity: EquipmentAnomalySummary["severity"] = "warning";

        const duplicateHourMeter = relatedFuel.some((record, index) => {
          if (index === 0) return false;
          return Number(record.hour_meter) < Number(relatedFuel[index - 1].hour_meter);
        });

        const stagnantHourMeterWithFuel = relatedFuel.some((record, index) => {
          if (index === 0) return false;
          const delta = Number(record.hour_meter) - Number(relatedFuel[index - 1].hour_meter);
          return delta === 0 && Number(record.liters) >= 20;
        });

        if (duplicateHourMeter || stagnantHourMeterWithFuel) {
          anomalyTypes.push("hourmeter");
          detailParts.push(duplicateHourMeter ? "horímetro regressivo entre abastecimentos" : "abastecimento registrado sem avanço de horímetro");
          impactParts.push("base de manutenção preventiva comprometida");
          severity = "critical";
        }

        if (relatedConsumption) {
          anomalyTypes.push("consumption");
          detailParts.push(`${relatedConsumption.variationPercent.toFixed(0)}% de desvio frente ao histórico em ${relatedConsumption.unit}`);
          impactParts.push("risco de desperdício, falha mecânica ou lançamento incorreto");
          if (relatedConsumption.variationPercent > 45) {
            severity = "critical";
          }
        }

        if (equipment.current_hour_meter < 0 || !Number.isFinite(Number(equipment.current_hour_meter))) {
          anomalyTypes.push("data");
          detailParts.push("horímetro atual inválido no cadastro");
          impactParts.push("decisão automática sem lastro confiável");
          severity = "critical";
        }

        if (anomalyTypes.length === 0) return null;

        return {
          id: `anomaly-${equipment.id}`,
          equipmentId: equipment.id,
          equipmentName: getEquipmentDisplayName(equipment),
          severity,
          anomalyTypes,
          summary: anomalyTypes.includes("hourmeter")
            ? "Inconsistência de leitura operacional detectada"
            : "Comportamento fora do padrão de consumo detectado",
          detail: detailParts.join(" · "),
          impact: impactParts.join(" · "),
          blocksAutoOs: severity === "critical" || anomalyTypes.includes("hourmeter") || anomalyTypes.includes("data"),
        } satisfies EquipmentAnomalySummary;
      })
      .filter((item): item is EquipmentAnomalySummary => item !== null)
      .sort((a, b) => {
        if (a.blocksAutoOs !== b.blocksAutoOs) return a.blocksAutoOs ? -1 : 1;
        if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
        return a.equipmentName.localeCompare(b.equipmentName);
      });

    const priorityRanking = [
      ...criticalOrders
        .filter((order: any) => equipmentMap[order.equipment_id]?.status !== "active")
        .map((order: any) => ({
          id: `p1-${order.id}`,
          title: `${getEquipmentDisplayName(equipmentMap[order.equipment_id])} parado com OS #${order.os_number}`,
          description: `${getPriorityDescriptor(order.priority)} · equipamento indisponível e ordem em aberto na oficina.`,
          priority: "p1" as const,
          priorityLabel: "Prioridade 1",
          score: 300 + priorityWeights[order.priority],
          onClick: () => navigate("/manutencao"),
        })),
      ...consumptionInsights.map((item) => ({
        id: `p2-${item.id}`,
        title: `${item.equipmentName} com desvio de consumo`,
        description: `${item.variationPercent.toFixed(0)}% acima do histórico real em ${item.unit}.`,
        priority: "p2" as const,
        priorityLabel: "Prioridade 2",
        score: 200 + item.variationPercent,
        onClick: () => navigate("/relatorios"),
      })),
      ...overdueMaintenance.map((item: any) => ({
        id: `p3-${item.id}`,
        title: `${item.equipmentName} com revisão vencida`,
        description: `${Math.abs(Math.round(item.remaining))} ${item.unit} de atraso no plano preventivo.`,
        priority: "p3" as const,
        priorityLabel: "Prioridade 3",
        score: 100 + Math.abs(item.remaining),
        onClick: () => navigate("/manutencao"),
      })),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score: _score, ...item }) => item);

    const lowFuelCombos = data.combos
      .map((combo: any) => {
        const fuelCapacity = Number(combo.fuel_capacity || 0);
        const lowLevelThreshold = fuelCapacity >= 5000 ? 1000 : fuelCapacity * 0.2;
        return {
          ...combo,
          lowLevelThreshold,
          currentFuel: Number(combo.current_fuel || 0),
        };
      })
      .filter((combo: any) => combo.currentFuel <= combo.lowLevelThreshold)
      .sort((a: any, b: any) => a.currentFuel - b.currentFuel);

    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const fuelPriceMap = Object.fromEntries(data.fuelPriceSettings.map((item: any) => [String(item.fuel_type || '').toLowerCase(), Number(item.unit_price || 0)]));
    const monthlyFuelCost = data.fuelRecords
      .filter((record: any) => String(record.date || '').startsWith(currentMonthKey))
      .reduce((sum: number, record: any) => sum + (Number(record.liters || 0) * Number(fuelPriceMap[String(record.fuel_type || '').toLowerCase()] || 0)), 0);
    const monthlyMaintenanceCost = data.workOrders
      .filter((order: any) => String(order.completed_at || order.created_at || '').startsWith(currentMonthKey))
      .reduce((sum: number, order: any) => sum + Number(order.labor_cost || 0) + Number(order.parts_cost || 0), 0);
    const monthlyCost = monthlyFuelCost + monthlyMaintenanceCost;

    const recommendations: RecommendationItem[] = [];

    if (criticalOrders.length > 0) {
      recommendations.push({
        id: "rec-critical-os",
        title: `Atribuir mecânico para ${criticalOrders.length} OS críticas`,
        description: "Despache a oficina primeiro nos equipamentos que estão travando a frente de obra.",
        tone: "critical",
        actionLabel: "Atribuir mecânico",
        onClick: () => navigate("/mecanico"),
      });
    }

    if (overdueMaintenance.length > 0) {
      recommendations.push({
        id: "rec-overdue-maintenance",
        title: `Gerar OS para ${overdueMaintenance.length} manutenção${overdueMaintenance.length === 1 ? "" : "ões"} atrasada${overdueMaintenance.length === 1 ? "" : "s"}`,
        description: "Antecipe a preventiva antes de transformar o atraso em parada corretiva.",
        tone: overdueMaintenance.length > 2 ? "critical" : "warning",
        actionLabel: "Abrir manutenção",
        onClick: () => navigate("/manutencao"),
      });
    }

    if (consumptionInsights[0]) {
      recommendations.push({
        id: "rec-consumption",
        title: `Verificar consumo de ${consumptionInsights[0].equipmentName}`,
        description: `${consumptionInsights[0].variationPercent.toFixed(0)}% de desvio em relação à média histórica real.`,
        tone: consumptionInsights[0].severity === "critical" ? "critical" : "warning",
        actionLabel: "Abrir análise",
        onClick: () => navigate("/relatorios"),
      });
    }

    if (lowFuelCombos[0]) {
      recommendations.push({
        id: "rec-low-fuel",
        title: `Abastecer ${lowFuelCombos[0].name}`,
        description: `Saldo abaixo de ${Math.round(lowFuelCombos[0].lowLevelThreshold)}L para sustentar a operação.`,
        tone: "warning",
        actionLabel: "Registrar abastecimento",
        onClick: () => navigate("/reabastecimento"),
      });
    }

    const openRequests = data.requests.filter((request: any) => request.status === "open").length;
    const inProgressRequests = data.requests.filter((request: any) => request.status === "in_progress").length;
    const activeEquipments = data.equipments.filter((equipment: any) => equipment.status === "active").length;

    return {
      todayChecklists,
      checklistCounts,
      maintenanceItems,
      overdueMaintenance,
      approachingMaintenance,
      activeOrders,
      criticalOrders,
      waitingPartsOrders,
      stoppedEquipments,
      consumptionInsights,
      anomalies,
      openRequests,
      inProgressRequests,
      activeEquipments,
      priorityRanking,
      recommendations: recommendations.slice(0, 4),
      lowFuelCombos,
      monthlyCost,
    };
  }, [data.checklists, data.combos, data.equipments, data.fuelPriceSettings, data.fuelRecords, data.plans, data.requests, data.workOrders, equipmentMap, navigate, today]);

  const actionableAlerts = useMemo<ActionableAlertItem[]>(
    () => [
      {
        id: "overdue-maintenance",
        label: "Manutenção atrasada",
        value: stats.overdueMaintenance.length,
        description: "Equipamentos que já ultrapassaram o ponto de revisão e precisam de despacho imediato.",
        icon: AlertTriangle,
        tone: stats.overdueMaintenance.length > 0 ? "critical" : "ok",
        actions: [
          {
            label: "Gerar OS automática",
            variant: stats.overdueMaintenance.length > 0 ? "destructive" : "outline",
            onClick: () => navigate("/pedido-manutencao"),
          },
          {
            label: "Programar manutenção",
            onClick: () => navigate("/manutencao"),
          },
        ],
      },
      {
        id: "critical-os",
        label: "OS críticas",
        value: stats.criticalOrders.length,
        description: "Ordens com prioridade alta ou urgente que ainda impactam a disponibilidade da frota.",
        icon: Wrench,
        tone: stats.criticalOrders.length > 0 ? "critical" : "ok",
        actions: [
          {
            label: "Atribuir mecânico",
            variant: stats.criticalOrders.length > 0 ? "destructive" : "outline",
            onClick: () => navigate("/mecanico"),
          },
          {
            label: "Priorizar",
            onClick: () => navigate("/manutencao"),
          },
        ],
      },
      {
        id: "stopped-equipments",
        label: "Equipamentos parados",
        value: stats.stoppedEquipments.length,
        description: "Ativos indisponíveis ou em manutenção, com risco direto à produção em campo.",
        icon: PauseCircle,
        tone: stats.stoppedEquipments.length > 0 ? "critical" : "ok",
        actions: [
          {
            label: "Ver disponibilidade",
            onClick: () => navigate("/equipamentos"),
          },
          {
            label: "Abrir manutenção",
            onClick: () => navigate("/manutencao"),
          },
        ],
      },
      {
        id: "abnormal-consumption",
        label: "Consumo anormal",
        value: stats.consumptionInsights.length,
        description: "Desvio calculado com unidade correta e comparação contra média histórica real dos últimos 60 dias.",
        icon: Truck,
        tone: stats.consumptionInsights.length > 0 ? "critical" : "ok",
        actions: [
          {
            label: "Abrir análise de consumo",
            variant: stats.consumptionInsights.length > 0 ? "destructive" : "outline",
            onClick: () => navigate("/relatorios"),
          },
          {
            label: "Comparar histórico",
            onClick: () => navigate("/abastecimento"),
          },
        ],
      },
      {
        id: "data-anomalies",
        label: "Dados inconsistentes",
        value: stats.anomalies.length,
        description: "Equipamentos com anomalias de horímetro/consumo que exigem validação antes de automações.",
        icon: AlertTriangle,
        tone: stats.anomalies.some((item) => item.blocksAutoOs) ? "critical" : stats.anomalies.length > 0 ? "warning" : "ok",
        actions: [
          {
            label: "Filtrar anomalias",
            variant: stats.anomalies.length > 0 ? "destructive" : "outline",
            onClick: () => setAnomalyFilter("blocked"),
          },
          {
            label: "Abrir equipamentos",
            onClick: () => navigate("/equipamentos"),
          },
        ],
      },
    ],
    [navigate, stats.anomalies, stats.consumptionInsights.length, stats.criticalOrders.length, stats.overdueMaintenance.length, stats.stoppedEquipments.length],
  );

  const commandDeckItems = useMemo<ExecutiveSignalItem[]>(() => [
    {
      id: "deck-overdue",
      label: "Manutenções atrasadas",
      value: stats.overdueMaintenance.length,
      tone: stats.overdueMaintenance.length > 0 ? "critical" : "ok",
      detail: "Preventivas vencidas com risco real de parada corretiva.",
    },
    {
      id: "deck-critical-os",
      label: "OS críticas",
      value: stats.criticalOrders.length,
      tone: stats.criticalOrders.length > 0 ? "critical" : "ok",
      detail: "Ordens de maior impacto para despacho imediato.",
    },
    {
      id: "deck-consumption",
      label: "Consumo anormal",
      value: stats.consumptionInsights.length,
      tone: stats.consumptionInsights.length > 0 ? "warning" : "ok",
      detail: "Ativos acima da curva histórica de eficiência.",
    },
    {
      id: "deck-anomalies",
      label: "Dados inconsistentes",
      value: stats.anomalies.length,
      tone: stats.anomalies.some((item) => item.blocksAutoOs) ? "critical" : stats.anomalies.length > 0 ? "warning" : "ok",
      detail: "Leituras incoerentes que bloqueiam automações sensíveis.",
      onClick: () => setAnomalyFilter("blocked"),
    },
    {
      id: "deck-active",
      label: "Equipamentos ativos",
      value: stats.activeEquipments,
      tone: stats.activeEquipments > 0 ? "ok" : "warning",
      detail: `${stats.stoppedEquipments.length} ativos estão indisponíveis agora.`,
      onClick: () => navigate("/equipamentos"),
    },
    {
      id: "deck-monthly-cost",
      label: "Custo mensal",
      value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(stats.monthlyCost),
      tone: stats.monthlyCost > 0 ? "warning" : "ok",
      detail: "Combina custo de combustível estimado e OS encerradas no mês.",
      onClick: () => navigate("/relatorios"),
    },
  ], [navigate, stats.activeEquipments, stats.anomalies, stats.consumptionInsights.length, stats.criticalOrders.length, stats.monthlyCost, stats.overdueMaintenance.length, stats.stoppedEquipments.length]);

  const commandDeckActions = useMemo<QuickActionItem[]>(() => [
    {
      id: "action-auto-os",
      label: "Gerar OS automática",
      onClick: () => navigate("/pedido-manutencao"),
      variant: stats.anomalies.some((item) => item.blocksAutoOs) ? "outline" : stats.overdueMaintenance.length > 0 ? "destructive" : "outline",
    },
    {
      id: "action-assign-mechanic",
      label: "Atribuir mecânico",
      onClick: () => navigate("/mecanico"),
      variant: "default",
    },
    {
      id: "action-view-priorities",
      label: "Ver prioridades",
      onClick: () => navigate("/manutencao"),
      variant: "secondary",
    },
  ], [navigate, stats.anomalies, stats.overdueMaintenance.length]);

  const filteredAnomalies = useMemo<EquipmentAnomalyItem[]>(() => {
    return stats.anomalies
      .filter((item) => {
        if (anomalyFilter === "blocked") return item.blocksAutoOs;
        if (anomalyFilter === "hourmeter") return item.anomalyTypes.includes("hourmeter");
        if (anomalyFilter === "consumption") return item.anomalyTypes.includes("consumption");
        return true;
      })
      .map((item) => ({
        id: item.id,
        equipmentName: item.equipmentName,
        severity: item.severity,
        anomalyTypes: item.anomalyTypes,
        summary: item.summary,
        detail: item.detail,
        impact: item.impact,
        blocksAutoOs: item.blocksAutoOs,
      }));
  }, [anomalyFilter, stats.anomalies]);

  const priorityNowItems = useMemo<PriorityNowItem[]>(() => {
    const operational = [
      ...stats.criticalOrders.slice(0, 3).map((order: any) => {
        const equipment = equipmentMap[order.equipment_id];
        const baseDate = order.started_at ? new Date(order.started_at) : new Date(order.created_at);
        const downtimeHours = Math.max(0, Math.round((Date.now() - baseDate.getTime()) / (1000 * 60 * 60)));

        return {
          id: `critical-${order.id}`,
          equipment: equipment?.name || "Equipamento",
          problem: order.description,
          impact: `OS ${order.priority === "urgent" ? "urgente" : "alta"} afetando disponibilidade operacional`,
          downtime: `${downtimeHours}h parado`,
          tone: "critical" as const,
          actionLabel: "Abrir execução",
          onAction: () => navigate("/mecanico"),
        };
      }),
      ...stats.overdueMaintenance.slice(0, 2).map((item: any) => ({
        id: `overdue-${item.id}`,
        equipment: item.equipmentName,
        problem: item.planLabel,
        impact: `${Math.abs(Math.round(item.remaining))} ${item.unit} de atraso com risco de parada`,
        downtime: equipmentMap[item.equipmentId]?.status === "active" ? "Risco iminente" : "Indisponível",
        tone: "warning" as const,
        actionLabel: "Programar OS",
        onAction: () => navigate("/manutencao"),
      })),
      ...stats.consumptionInsights.slice(0, 2).map((item) => ({
        id: `consumption-${item.id}`,
        equipment: item.equipmentName,
        problem: "Consumo fora do padrão operacional",
        impact: `${item.variationPercent.toFixed(0)}% acima da média histórica`,
        downtime: "Impacto financeiro em curso",
        tone: item.severity === "critical" ? "critical" as const : "action" as const,
        actionLabel: "Ver análise",
        onAction: () => navigate("/relatorios"),
      })),
    ];

    return operational.slice(0, 6);
  }, [equipmentMap, navigate, stats.consumptionInsights, stats.criticalOrders, stats.overdueMaintenance]);

  const kpis = useMemo<DashboardKpiItem[]>(
    () => [
      {
        id: "equipments",
        label: "Total equipamentos",
        value: String(data.equipments.length),
        context: `${stats.activeEquipments} ativos e ${stats.stoppedEquipments.length} parados`,
        icon: Truck,
        onClick: () => navigate("/equipamentos"),
      },
      {
        id: "work-orders",
        label: "Total OS",
        value: String(data.workOrders.length),
        context: `${stats.activeOrders.length} abertas/em andamento (${stats.criticalOrders.length} críticas)`,
        icon: Wrench,
        onClick: () => navigate("/manutencao"),
      },
      {
        id: "checklists",
        label: "Checklists",
        value: String(data.checklists.length),
        context: `${stats.todayChecklists.length} hoje (${stats.checklistCounts.critical} críticos)`,
        icon: ClipboardCheck,
        onClick: () => navigate("/checklist"),
      },
    ],
    [data.checklists.length, data.equipments.length, data.workOrders.length, navigate, stats.activeEquipments, stats.activeOrders.length, stats.checklistCounts.critical, stats.criticalOrders.length, stats.stoppedEquipments.length, stats.todayChecklists.length],
  );

  const maintenanceList = useMemo<MaintenancePriorityItem[]>(
    () =>
      stats.maintenanceItems.slice(0, 8).map((item: any) => ({
        id: item.id,
        equipmentName: item.equipmentName,
        currentHourMeter: item.currentHourMeter,
        status: item.status,
        timingLabel: formatPlanTiming(item.remaining, item.unit, item.status),
        planLabel: item.planLabel,
        onOpen: () => navigate("/manutencao"),
      })),
    [navigate, stats.maintenanceItems],
  );

  const workOrderItems = useMemo<WorkOrderStatusItem[]>(
    () => [
      {
        id: "os-open",
        label: "OS abertas",
        count: data.workOrders.filter((order: any) => order.status === "open").length,
        description: `${stats.openRequests} pedido${stats.openRequests === 1 ? "" : "s"} aguardando andamento`,
        icon: Wrench,
        tone: data.workOrders.some((order: any) => order.status === "open") ? "warning" : "ok",
        onClick: () => navigate("/manutencao"),
      },
      {
        id: "os-progress",
        label: "OS em andamento",
        count: data.workOrders.filter((order: any) => order.status === "in_progress").length,
        description: `${stats.inProgressRequests} pedido${stats.inProgressRequests === 1 ? "" : "s"} em execução`,
        icon: Wrench,
        tone: data.workOrders.some((order: any) => order.status === "in_progress") ? "warning" : "ok",
        onClick: () => navigate("/manutencao"),
      },
      {
        id: "os-parts",
        label: "OS aguardando peça",
        count: stats.waitingPartsOrders.length,
        description: "Identificadas por observação operacional pendente.",
        icon: Wrench,
        tone: stats.waitingPartsOrders.length > 0 ? "warning" : "neutral",
        onClick: () => navigate("/manutencao"),
      },
      {
        id: "os-critical",
        label: "OS críticas",
        count: stats.criticalOrders.length,
        description: "Prioridade alta ou urgente sem conclusão.",
        icon: Wrench,
        tone: stats.criticalOrders.length > 0 ? "critical" : "ok",
        onClick: () => navigate("/manutencao"),
      },
    ],
    [data.workOrders, navigate, stats.criticalOrders.length, stats.inProgressRequests, stats.openRequests, stats.waitingPartsOrders.length],
  );

  const checklistItems = useMemo<ChecklistOverviewItem[]>(
    () =>
      stats.todayChecklists.map((checklist: any) => {
        const equipment = equipmentMap[checklist.equipment_id];
        const nonConformities = Array.isArray(checklist.items)
          ? checklist.items.filter((item: any) => item.checked === false).length
          : 0;

        return {
          id: checklist.id,
          equipmentName: equipment?.name || "Equipamento",
          operatorName: checklist.operator_name,
          typeLabel:
            checklist.type === "corrective"
              ? "Corretivo"
              : checklist.type === "preventive"
                ? "Preventivo"
                : "Diário",
          timeLabel: new Date(checklist.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: checklist.status,
          nonConformities,
          onClick: () => setSelectedChecklist(checklist),
        } satisfies ChecklistOverviewItem;
      }),
    [equipmentMap, stats.todayChecklists],
  );

  const comboItems = useMemo<FuelOpsItem[]>(
    () =>
      data.combos.map((combo: any) => {
        const fuelCapacity = Number(combo.fuel_capacity || 0);
        const currentFuel = Number(combo.current_fuel || 0);
        const lowLevelThreshold = fuelCapacity >= 5000 ? 1000 : fuelCapacity * 0.2;
        const dispatchesToday = data.fuelRecords.filter((record: any) => record.combo_equipment_id === combo.id && record.date === today).length;
        const latestSupply = data.fuelSupplyRecords.find((record: any) => record.combo_equipment_id === combo.id);

        return {
          id: combo.id,
          name: combo.name,
          currentFuel,
          fuelCapacity,
          percentage: fuelCapacity ? (currentFuel / fuelCapacity) * 100 : 0,
          dispatchesToday,
          lastSupplyLabel: latestSupply ? formatDateLabel(latestSupply.date) : "sem registro",
          lowLevelThreshold,
        } satisfies FuelOpsItem;
      }),
    [data.combos, data.fuelRecords, data.fuelSupplyRecords, today],
  );

  const summary = useMemo(
    () =>
      buildSystemSummary({
        overdueCount: stats.overdueMaintenance.length,
        abnormalCount: stats.consumptionInsights.length,
        openOrders: stats.activeOrders.length,
        criticalOrders: stats.criticalOrders.length,
        stoppedCount: stats.stoppedEquipments.length,
        recommendedCount: stats.recommendations.length,
      }),
    [stats.activeOrders.length, stats.consumptionInsights.length, stats.criticalOrders.length, stats.overdueMaintenance.length, stats.recommendations.length, stats.stoppedEquipments.length],
  );

  const hasCriticalItems =
    stats.overdueMaintenance.length > 0 ||
    stats.criticalOrders.length > 0 ||
    stats.stoppedEquipments.length > 0 ||
    stats.consumptionInsights.length > 0;

  return (
    <div className="space-y-5">
      <DashboardHero
        title="Central operacional"
        subtitle={todayLabel}
        summary={summary}
        onRefresh={fetchData}
        onSignOut={signOut}
        refreshing={isRefreshing}
      />

      <OperationalCommandDeck items={commandDeckItems} actions={commandDeckActions} />
      <ActionableAlertsPanel items={actionableAlerts} />
      <KpiSummaryGrid items={kpis} />

      {!hasCriticalItems && <EmptyOperationalState />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <PriorityNowSection items={priorityNowItems} />
        <RecommendedActionsSection items={stats.recommendations} />
      </div>

      <EquipmentAnomaliesSection
        items={filteredAnomalies}
        selectedFilter={anomalyFilter}
        onFilterChange={setAnomalyFilter}
        onOpenEquipments={() => navigate("/equipamentos")}
      />

      <PriorityRankingSection items={stats.priorityRanking as PriorityRankingItem[]} />

      <div id="ai-operacional-section">
        <AIMaintenanceDecisionsSection
          items={aiDecisions}
          loading={aiLoading}
          errorMessage={aiErrorMessage}
          hasGenerated={aiHasGenerated}
          creatingId={creatingAiDecisionId}
          onRefresh={loadAiDecisions}
          onCreateWorkOrder={handleCreateAiWorkOrder}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <MaintenancePriorityList items={maintenanceList} onOpenAll={() => navigate("/manutencao")} />
        <WorkOrdersOperationalBlock items={workOrderItems} />
      </div>

      <ConsumptionOperationsSection items={stats.consumptionInsights as ConsumptionDetailedItem[]} onOpenReports={() => navigate("/relatorios")} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <ChecklistOverviewSection items={checklistItems} />
        <FuelOperationsSection
          items={comboItems}
          onRegisterFuel={() => navigate("/abastecimento")}
          onOpenSupply={() => navigate("/reabastecimento")}
        />
      </div>

      <Dialog open={!!selectedChecklist} onOpenChange={() => setSelectedChecklist(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          {selectedChecklist && (() => {
            const equipment = equipmentMap[selectedChecklist.equipment_id];
            const items = Array.isArray(selectedChecklist.items) ? selectedChecklist.items : [];
            const typeLabel =
              selectedChecklist.type === "corrective"
                ? "Corretivo"
                : selectedChecklist.type === "preventive"
                  ? "Preventivo"
                  : "Diário";
            const statusClass =
              selectedChecklist.status === "ok"
                ? "text-success"
                : selectedChecklist.status === "attention"
                  ? "text-warning"
                  : "text-destructive";

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-left">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    Checklist — {equipment?.name || "Equipamento"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground">Operador</p>
                      <p className="font-semibold text-foreground">{selectedChecklist.operator_name}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground">Horímetro</p>
                      <p className="font-semibold text-foreground">{selectedChecklist.hour_meter}h</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="font-semibold text-foreground">{typeLabel}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className={`font-semibold ${statusClass}`}>
                        {selectedChecklist.status === "ok"
                          ? "Conforme"
                          : selectedChecklist.status === "attention"
                            ? "Atenção"
                            : "Crítico"}
                      </p>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Itens de verificação</h3>
                      <div className="space-y-2">
                        {items.map((item: any, index: number) => (
                          <div
                            key={item.id || index}
                            className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                              item.checked === true
                                ? "bg-success/10"
                                : item.checked === false
                                  ? "bg-destructive/10"
                                  : "bg-secondary/50"
                            }`}
                          >
                            {item.checked === true ? (
                              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                            ) : item.checked === false ? (
                              <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                            ) : (
                              <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-muted-foreground" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground">{item.label}</p>
                              {item.observation && <p className="mt-1 text-xs text-muted-foreground">📝 {item.observation}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedChecklist.observations && (
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Observações gerais</p>
                      </div>
                      <p className="text-sm text-foreground">{selectedChecklist.observations}</p>
                    </div>
                  )}

                  {selectedChecklist.photo_url && (
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Foto</p>
                      </div>
                      <img src={selectedChecklist.photo_url} alt="Foto do checklist" className="w-full rounded-lg object-cover" />
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
