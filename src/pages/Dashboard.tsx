import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, PauseCircle, Truck, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateMaintenanceStatus } from "@/lib/maintenance-utils";
import {
  ChecklistOverviewItem,
  ComboFuelItem,
  ConsumptionInsightItem,
  CriticalAlertsPanel,
  DashboardHero,
  DashboardKpiItem,
  EmptyOperationalState,
  KpiSummaryGrid,
  MaintenancePriorityItem,
  MaintenancePriorityList,
  ChecklistOverviewSection,
  ComboFuelSection,
  ConsumptionInsightsBlock,
  WorkOrdersOperationalBlock,
  WorkOrderStatusItem,
} from "@/components/dashboard/OperationalDashboardSections";
import { Camera, MessageSquare, ShieldCheck, ShieldX } from "lucide-react";

type DashboardData = {
  equipments: any[];
  checklists: any[];
  plans: any[];
  fuelRecords: any[];
  requests: any[];
  combos: any[];
  workOrders: any[];
};

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

function buildSystemSummary({ overdueCount, abnormalCount, openOrders, criticalOrders, stoppedCount }: {
  overdueCount: number;
  abnormalCount: number;
  openOrders: number;
  criticalOrders: number;
  stoppedCount: number;
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

  return `Hoje existem ${segments.join(", ")}.`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [data, setData] = useState<DashboardData>({
    equipments: [],
    checklists: [],
    plans: [],
    fuelRecords: [],
    requests: [],
    combos: [],
    workOrders: [],
  });

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    const [eqRes, clRes, plRes, frRes, reqRes, woRes] = await Promise.all([
      supabase.from("equipments").select("*"),
      supabase.from("checklists").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("maintenance_plans").select("*"),
      supabase.from("fuel_records").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("maintenance_requests").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("work_orders").select("*").order("created_at", { ascending: false }).limit(100),
    ]);

    const equipments = eqRes.data || [];
    setData({
      equipments,
      checklists: clRes.data || [],
      plans: plRes.data || [],
      fuelRecords: frRes.data || [],
      requests: reqRes.data || [],
      combos: equipments.filter((equipment: any) => equipment.type === "combo"),
      workOrders: woRes.data || [],
    });
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = new Date().toISOString().split("T")[0];
  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const equipmentMap = useMemo(
    () => Object.fromEntries(data.equipments.map((equipment: any) => [equipment.id, equipment])),
    [data.equipments]
  );

  const stats = useMemo(() => {
    const todayChecklists = data.checklists.filter((checklist: any) => checklist.date === today);
    const checklistCounts = {
      ok: data.checklists.filter((checklist: any) => checklist.status === "ok").length,
      attention: data.checklists.filter((checklist: any) => checklist.status === "attention").length,
      critical: data.checklists.filter((checklist: any) => checklist.status === "critical").length,
    };

    const maintenanceItems = data.plans
      .map((plan: any) => {
        const equipment = equipmentMap[plan.equipment_id];
        if (!equipment) return null;
        const remaining = Number(plan.next_due_at) - Number(equipment.current_hour_meter || 0);
        const status = calculateMaintenanceStatus(remaining, equipment.type);
        return {
          id: plan.id,
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          currentHourMeter: Number(equipment.current_hour_meter || 0),
          status,
          remaining,
          unit: getPlanUnit(equipment.type),
          planLabel: `${plan.description} · meta ${Math.round(Number(plan.next_due_at) || 0)} ${getPlanUnit(equipment.type)}`,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const order = { overdue: 0, approaching: 1, ok: 2 };
        const statusDiff = order[a.status as keyof typeof order] - order[b.status as keyof typeof order];
        if (statusDiff !== 0) return statusDiff;
        return a.remaining - b.remaining;
      });

    const overdueMaintenance = maintenanceItems.filter((item: any) => item.status === "overdue");
    const approachingMaintenance = maintenanceItems.filter((item: any) => item.status === "approaching");
    const activeOrders = data.workOrders.filter((order: any) => order.status !== "done");
    const criticalOrders = activeOrders.filter((order: any) => priorityWeights[order.priority] >= priorityWeights.high);
    const waitingPartsOrders = activeOrders.filter((order: any) => inferWaitingParts(order));
    const stoppedEquipments = data.equipments.filter((equipment: any) => equipment.status !== "active");

    const fuelMetrics = data.fuelRecords.reduce((acc: Record<string, any[]>, record: any) => {
      const targetId = record.target_equipment_id;
      const hourMeter = Number(record.hour_meter || 0);
      const fuelType = String(record.fuel_type || "").toLowerCase();
      if (!targetId || !hourMeter || fuelType === "arla") return acc;
      if (!acc[targetId]) acc[targetId] = [];
      acc[targetId].push({
        date: record.date,
        created_at: record.created_at,
        hour_meter: hourMeter,
        liters: Number(record.liters || 0),
      });
      return acc;
    }, {});

    const equipmentEfficiency = Object.entries(fuelMetrics)
      .map(([equipmentId, records]) => {
        const equipment = equipmentMap[equipmentId];
        if (!equipment || records.length < 2) return null;

        const sortedRecords = [...records].sort(
          (a: any, b: any) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)
        );

        let liters = 0;
        let delta = 0;

        for (let index = 1; index < sortedRecords.length; index += 1) {
          const current = sortedRecords[index];
          const previous = sortedRecords[index - 1];
          const difference = current.hour_meter - previous.hour_meter;
          if (difference > 0 && current.liters > 0) {
            liters += current.liters;
            delta += difference;
          }
        }

        if (!delta || !liters) return null;

        const metric = equipment.type === "truck" ? delta / liters : liters / delta;
        return {
          equipmentId,
          equipmentName: equipment.name,
          type: equipment.type === "truck" ? "truck" : "equipment",
          metric,
          unit: equipment.type === "truck" ? "km/L" : "L/h",
        };
      })
      .filter(Boolean) as Array<{ equipmentId: string; equipmentName: string; type: "truck" | "equipment"; metric: number; unit: string }>;

    const groupAverage = equipmentEfficiency.reduce(
      (acc, item) => {
        acc[item.type].sum += item.metric;
        acc[item.type].count += 1;
        return acc;
      },
      {
        truck: { sum: 0, count: 0 },
        equipment: { sum: 0, count: 0 },
      }
    );

    const consumptionInsights = equipmentEfficiency
      .map((item) => {
        const averageBase = groupAverage[item.type];
        const average = averageBase.count ? averageBase.sum / averageBase.count : 0;
        if (!average) return null;

        if (item.type === "truck") {
          const variation = ((average - item.metric) / average) * 100;
          if (variation < 15) return null;
          return {
            id: item.equipmentId,
            equipmentName: item.equipmentName,
            variationPercent: variation,
            metricLabel: `${item.metric.toFixed(2)} ${item.unit} frente à média de ${average.toFixed(2)} ${item.unit}`,
            severity: variation >= 30 ? "critical" : "warning",
          } satisfies ConsumptionInsightItem;
        }

        const variation = ((item.metric - average) / average) * 100;
        if (variation < 15) return null;
        return {
          id: item.equipmentId,
          equipmentName: item.equipmentName,
          variationPercent: variation,
          metricLabel: `${item.metric.toFixed(2)} ${item.unit} frente à média de ${average.toFixed(2)} ${item.unit}`,
          severity: variation >= 30 ? "critical" : "warning",
        } satisfies ConsumptionInsightItem;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.variationPercent - a.variationPercent);

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
      openRequests,
      inProgressRequests,
      activeEquipments,
    };
  }, [data.checklists, data.equipments, data.fuelRecords, data.plans, data.requests, data.workOrders, equipmentMap, today]);

  const criticalAlerts = useMemo(
    () => [
      {
        id: "overdue-maintenance",
        label: "Manutenção atrasada",
        value: stats.overdueMaintenance.length,
        description: "Equipamentos que já ultrapassaram o ponto de revisão.",
        actionLabel: "Ver detalhes",
        onClick: () => navigate("/manutencao"),
        icon: AlertTriangle,
        tone: stats.overdueMaintenance.length > 0 ? "critical" : "ok",
      },
      {
        id: "critical-os",
        label: "OS críticas",
        value: stats.criticalOrders.length,
        description: "Ordens com prioridade alta ou urgente ainda sem baixa.",
        actionLabel: "Ver detalhes",
        onClick: () => navigate("/manutencao"),
        icon: Wrench,
        tone: stats.criticalOrders.length > 0 ? "critical" : "ok",
      },
      {
        id: "stopped-equipments",
        label: "Equipamentos parados",
        value: stats.stoppedEquipments.length,
        description: "Ativos indisponíveis ou em manutenção no momento.",
        actionLabel: "Ver detalhes",
        onClick: () => navigate("/equipamentos"),
        icon: PauseCircle,
        tone: stats.stoppedEquipments.length > 0 ? "critical" : "ok",
      },
      {
        id: "abnormal-consumption",
        label: "Consumo anormal",
        value: stats.consumptionInsights.length,
        description: "Equipamentos com desvio relevante no padrão de consumo.",
        actionLabel: "Ver detalhes",
        onClick: () => navigate("/relatorios"),
        icon: Truck,
        tone: stats.consumptionInsights.length > 0 ? "critical" : "ok",
      },
    ],
    [navigate, stats.consumptionInsights.length, stats.criticalOrders.length, stats.overdueMaintenance.length, stats.stoppedEquipments.length]
  );

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
    [data.checklists.length, data.equipments.length, data.workOrders.length, navigate, stats.activeEquipments, stats.activeOrders.length, stats.checklistCounts.critical, stats.criticalOrders.length, stats.stoppedEquipments.length, stats.todayChecklists.length]
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
    [navigate, stats.maintenanceItems]
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
    [data.workOrders, navigate, stats.criticalOrders.length, stats.inProgressRequests, stats.openRequests, stats.waitingPartsOrders.length]
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
    [equipmentMap, stats.todayChecklists]
  );

  const comboItems = useMemo<ComboFuelItem[]>(
    () =>
      data.combos.map((combo: any) => ({
        id: combo.id,
        name: combo.name,
        currentFuel: Number(combo.current_fuel || 0),
        fuelCapacity: Number(combo.fuel_capacity || 0),
        percentage: combo.fuel_capacity ? (Number(combo.current_fuel || 0) / Number(combo.fuel_capacity)) * 100 : 0,
      })),
    [data.combos]
  );

  const summary = useMemo(
    () =>
      buildSystemSummary({
        overdueCount: stats.overdueMaintenance.length,
        abnormalCount: stats.consumptionInsights.length,
        openOrders: stats.activeOrders.length,
        criticalOrders: stats.criticalOrders.length,
        stoppedCount: stats.stoppedEquipments.length,
      }),
    [stats.activeOrders.length, stats.consumptionInsights.length, stats.criticalOrders.length, stats.overdueMaintenance.length, stats.stoppedEquipments.length]
  );

  const hasCriticalItems =
    stats.overdueMaintenance.length > 0 ||
    stats.criticalOrders.length > 0 ||
    stats.stoppedEquipments.length > 0 ||
    stats.consumptionInsights.length > 0;

  return (
    <div className="space-y-5">
      <DashboardHero
        title="Dashboard operacional"
        subtitle={todayLabel}
        summary={summary}
        onRefresh={fetchData}
        onSignOut={signOut}
        refreshing={isRefreshing}
      />

      <CriticalAlertsPanel items={criticalAlerts} />
      <KpiSummaryGrid items={kpis} />

      {!hasCriticalItems && <EmptyOperationalState />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <MaintenancePriorityList items={maintenanceList} onOpenAll={() => navigate("/manutencao")} />
        <WorkOrdersOperationalBlock items={workOrderItems} />
      </div>

      <ConsumptionInsightsBlock items={stats.consumptionInsights} onOpenReports={() => navigate("/relatorios")} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ChecklistOverviewSection items={checklistItems} />
        <ComboFuelSection items={comboItems} onOpenSupply={() => navigate("/reabastecimento")} />
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
