import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Coins, Fuel, TimerReset, Truck, Wrench } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DBEquipment, DBFuelPriceSetting } from "@/lib/supabase-types";
import { calculateMaintenanceStatus } from "@/lib/maintenance-utils";

type ExecutiveData = {
  equipments: any[];
  fuelRecords: any[];
  workOrders: any[];
  maintenanceHistory: any[];
  plans: any[];
  obras: any[];
  fuelPriceSettings: DBFuelPriceSetting[];
};

type FinancialItem = {
  equipmentId: string;
  equipmentName: string;
  obraName: string;
  totalCost: number;
  fuelCost: number;
  maintenanceCost: number;
  downtimeCost: number;
  downtimeHours: number;
  operatingBase: number;
  costPerHour: number | null;
  costPerKm: number | null;
  abnormalLoss: number;
  availability: number;
  criticality: number;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function getBaseMetric(eq: any, fuelRecords: any[]) {
  const records = fuelRecords
    .filter((r) => r.target_equipment_id === eq.id && Number(r.hour_meter || 0) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created_at || "").localeCompare(String(b.created_at || "")));

  if (records.length >= 2) {
    const delta = Number(records[records.length - 1].hour_meter) - Number(records[0].hour_meter);
    return Math.max(delta, 0);
  }

  return Number(eq.current_hour_meter || 0);
}

function getDowntimeHours(order: any) {
  const start = order.started_at ? new Date(order.started_at).getTime() : new Date(order.created_at).getTime();
  const end = order.completed_at ? new Date(order.completed_at).getTime() : Date.now();
  const diff = (end - start) / (1000 * 60 * 60);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

export default function ExecutiveDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExecutiveData>({
    equipments: [],
    fuelRecords: [],
    workOrders: [],
    maintenanceHistory: [],
    plans: [],
    obras: [],
    fuelPriceSettings: [],
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [equipments, fuelRecords, workOrders, maintenanceHistory, plans, obras, fuelPriceSettings] = await Promise.all([
        supabase.from("equipments").select("*"),
        supabase.from("fuel_records").select("*").order("date", { ascending: false }).limit(1500),
        supabase.from("work_orders").select("*").order("created_at", { ascending: false }).limit(600),
        supabase.from("maintenance_history").select("*").order("executed_at", { ascending: false }).limit(1000),
        supabase.from("maintenance_plans").select("*"),
        supabase.from("obras").select("*"),
        supabase.from("fuel_price_settings").select("*").order("fuel_type"),
      ]);

      setData({
        equipments: equipments.data || [],
        fuelRecords: fuelRecords.data || [],
        workOrders: workOrders.data || [],
        maintenanceHistory: maintenanceHistory.data || [],
        plans: plans.data || [],
        obras: obras.data || [],
        fuelPriceSettings: (fuelPriceSettings.data || []) as DBFuelPriceSetting[],
      });
      setLoading(false);
    };

    load();
  }, []);

  const metrics = useMemo(() => {
    const fuelPriceMap = Object.fromEntries(data.fuelPriceSettings.map((item) => [String(item.fuel_type || '').toLowerCase(), Number(item.unit_price || 0)]));
    const obraMap = Object.fromEntries(data.obras.map((obra: any) => [obra.id, obra]));

    const items: FinancialItem[] = data.equipments
      .filter((eq: any) => eq.type !== "combo")
      .map((eq: any) => {
        const eqFuel = data.fuelRecords.filter((record: any) => record.target_equipment_id === eq.id);
        const fuelCost = eqFuel.reduce((sum: number, record: any) => {
          const price = fuelPriceMap[String(record.fuel_type || "diesel").toLowerCase()] || 0;
          return sum + Number(record.liters || 0) * price;
        }, 0);

        const historyCost = data.maintenanceHistory
          .filter((item: any) => item.equipment_id === eq.id)
          .reduce((sum: number, item: any) => sum + Number(item.parts_cost || 0) + Number(item.labor_cost || 0), 0);

        const orderCost = data.workOrders
          .filter((item: any) => item.equipment_id === eq.id)
          .reduce((sum: number, item: any) => sum + Number(item.parts_cost || 0) + Number(item.labor_cost || 0), 0);

        const relatedOrders = data.workOrders.filter((item: any) => item.equipment_id === eq.id);
        const downtimeHours = relatedOrders.reduce((sum: number, item: any) => sum + getDowntimeHours(item), 0);
        const downtimeCost = downtimeHours * Number(eq.cost_per_hour || 0);
        const maintenanceCost = historyCost + orderCost;
        const totalCost = fuelCost + maintenanceCost + downtimeCost;

        const operatingBase = getBaseMetric(eq, data.fuelRecords);
        const costPerHour = eq.type === "truck" ? null : operatingBase > 0 ? totalCost / operatingBase : null;
        const costPerKm = eq.type === "truck" ? (operatingBase > 0 ? totalCost / operatingBase : null) : null;

        const plans = data.plans.filter((plan: any) => plan.equipment_id === eq.id);
        const planRisk = plans.reduce((sum: number, plan: any) => {
          const remaining = Number(plan.next_due_at || 0) - Number(eq.current_hour_meter || 0);
          const status = calculateMaintenanceStatus(remaining, eq.type);
          return sum + (status === "overdue" ? 35 : status === "approaching" ? 18 : 4);
        }, 0);

        const abnormalLoss = eqFuel.reduce((sum: number, record: any, index: number, all: any[]) => {
          if (index === 0) return sum;
          const currentHM = Number(record.hour_meter || 0);
          const prevHM = Number(all[index - 1]?.hour_meter || 0);
          const liters = Number(record.liters || 0);
          if (!currentHM || !prevHM || currentHM <= prevHM || liters <= 0) return sum;
          const delta = currentHM - prevHM;
          const metric = eq.type === "truck" ? delta / liters : liters / delta;
          const history = all.slice(Math.max(0, index - 4), index).map((item: any, histIndex: number, histAll: any[]) => {
            const prev = histIndex > 0 ? histAll[histIndex - 1] : null;
            if (!prev) return null;
            const curHM = Number(item.hour_meter || 0);
            const prvHM = Number(prev.hour_meter || 0);
            const curLiters = Number(item.liters || 0);
            if (!curHM || !prvHM || curHM <= prvHM || curLiters <= 0) return null;
            const curDelta = curHM - prvHM;
            return eq.type === "truck" ? curDelta / curLiters : curLiters / curDelta;
          }).filter(Boolean);
          if (!history.length) return sum;
          const avg = history.reduce((acc: number, value: any) => acc + Number(value), 0) / history.length;
          if (!avg) return sum;
          const price = fuelPriceMap[String(record.fuel_type || "diesel").toLowerCase()] || 0;
          if (eq.type === "truck") {
            const expectedLiters = delta / avg;
            return liters > expectedLiters * 1.3 ? sum + (liters - expectedLiters) * price : sum;
          }
          const expectedLiters = delta * avg;
          return liters > expectedLiters * 1.3 ? sum + (liters - expectedLiters) * price : sum;
        }, 0);

        const criticality = Math.min(100, Math.round(planRisk + (downtimeHours > 24 ? 20 : downtimeHours > 8 ? 10 : 0) + (abnormalLoss > 0 ? 15 : 0) + (eq.status !== "active" ? 20 : 0)));

        const totalOrders = relatedOrders.length;
        const completedOrders = relatedOrders.filter((item: any) => item.status === "done").length;
        const availability = totalOrders === 0 ? (eq.status === "active" ? 100 : 80) : Math.max(0, Math.min(100, 100 - ((totalOrders - completedOrders) / totalOrders) * 100));

        return {
          equipmentId: eq.id,
          equipmentName: eq.name,
          obraName: obraMap[eq.obra_id]?.name || "Sem obra",
          totalCost,
          fuelCost,
          maintenanceCost,
          downtimeCost,
          downtimeHours,
          operatingBase,
          costPerHour,
          costPerKm,
          abnormalLoss,
          availability,
          criticality,
        };
      });

    const operationCost = items.reduce((sum, item) => sum + item.totalCost, 0);
    const totalFuel = data.fuelRecords.reduce((sum: number, item: any) => sum + Number(item.liters || 0), 0);
    const fleetAvailability = items.length ? items.reduce((sum, item) => sum + item.availability, 0) / items.length : 100;

    const costByObra = Object.values(items.reduce((acc: Record<string, { obraName: string; totalCost: number; equipments: number }>, item) => {
      if (!acc[item.obraName]) acc[item.obraName] = { obraName: item.obraName, totalCost: 0, equipments: 0 };
      acc[item.obraName].totalCost += item.totalCost;
      acc[item.obraName].equipments += 1;
      return acc;
    }, {})).sort((a, b) => b.totalCost - a.totalCost);

    const criticalProblems = items
      .filter((item) => item.criticality >= 40 || item.abnormalLoss > 0 || item.availability < 85)
      .sort((a, b) => b.criticality - a.criticality)
      .slice(0, 6);

    return { items, operationCost, totalFuel, fleetAvailability, costByObra, criticalProblems };
  }, [data]);

  const topCosts = useMemo(() => [...metrics.items].sort((a, b) => b.totalCost - a.totalCost).slice(0, 8), [metrics.items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground">Dashboard Executivo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Camada financeira e operacional consolidada para concessionárias e grandes frotas.</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>Exportar visão rápida</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-muted-foreground"><Coins className="h-4 w-4 text-primary" /> Custo total da operação</div><p className="mt-3 text-3xl font-black text-foreground">{currency.format(metrics.operationCost)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-muted-foreground"><Fuel className="h-4 w-4 text-warning" /> Consumo total</div><p className="mt-3 text-3xl font-black text-foreground">{number.format(metrics.totalFuel)} L</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-muted-foreground"><Truck className="h-4 w-4 text-success" /> Disponibilidade da frota</div><p className="mt-3 text-3xl font-black text-foreground">{number.format(metrics.fleetAvailability)}%</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-4 w-4 text-destructive" /> Problemas críticos</div><p className="mt-3 text-3xl font-black text-foreground">{metrics.criticalProblems.length}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base font-black"><BarChart3 className="h-4 w-4 text-primary" /> Ranking de equipamentos mais caros</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Carregando indicadores...</p> : topCosts.map((item, index) => (
              <div key={item.equipmentId} className="rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{index + 1}. {item.equipmentName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.obraName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-destructive">{currency.format(item.totalCost)}</p>
                    <p className="text-xs text-muted-foreground">risco {item.criticality}/100</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <div className="rounded-md bg-background/80 p-2"><span className="block">Combustível</span><strong className="text-foreground">{currency.format(item.fuelCost)}</strong></div>
                  <div className="rounded-md bg-background/80 p-2"><span className="block">Manutenção</span><strong className="text-foreground">{currency.format(item.maintenanceCost)}</strong></div>
                  <div className="rounded-md bg-background/80 p-2"><span className="block">Parada</span><strong className="text-foreground">{currency.format(item.downtimeCost)}</strong></div>
                  <div className="rounded-md bg-background/80 p-2"><span className="block">Prejuízo anormal</span><strong className="text-foreground">{currency.format(item.abnormalLoss)}</strong></div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="rounded-md bg-background/80 p-2"><span className="block">Custo/hora</span><strong className="text-foreground">{item.costPerHour !== null ? currency.format(item.costPerHour) : '—'}</strong></div>
                  <div className="rounded-md bg-background/80 p-2"><span className="block">Custo/km</span><strong className="text-foreground">{item.costPerKm !== null ? currency.format(item.costPerKm) : '—'}</strong></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base font-black"><Wrench className="h-4 w-4 text-warning" /> Ranking de problemas críticos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {metrics.criticalProblems.map((item) => (
                <div key={item.equipmentId} className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-foreground">{item.equipmentName}</p>
                    <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">{item.criticality}/100</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted-foreground">
                    <p>Disponibilidade: <strong className="text-foreground">{number.format(item.availability)}%</strong></p>
                    <p>Impacto financeiro estimado: <strong className="text-foreground">{currency.format(item.totalCost + item.abnormalLoss)}</strong></p>
                    <p>Impacto operacional: <strong className="text-foreground">{number.format(item.downtimeHours)} h de parada</strong></p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base font-black"><TimerReset className="h-4 w-4 text-primary" /> Custo por obra</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {metrics.costByObra.map((item) => (
                <div key={item.obraName} className="rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-foreground">{item.obraName}</p>
                    <p className="text-sm font-black text-primary">{currency.format(item.totalCost)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.equipments} equipamento(s) vinculados</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
