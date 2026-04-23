import { DBEquipment, DBFuelPriceSetting, DBMaintenanceHistory, DBObra, DBWorkOrder } from "@/lib/supabase-types";
import { getEquipmentDisplayName } from "@/lib/equipment-display";

type WorkOrderFinancialLike = DBWorkOrder & {
  parts_cost?: number | null;
  labor_cost?: number | null;
  parts?: unknown;
  part_code?: string | null;
};

export type ReportType = "maintenance" | "obra" | "executive";

export interface MaintenanceEquipmentReportRow {
  equipmentId: string;
  equipmentName: string;
  obraName: string;
  date: string;
  source: "Histórico" | "OS";
  description: string;
  parts: string;
  partsCost: number;
  laborCost: number;
  totalCost: number;
  status: string;
}

export interface ObraProfessionalReportRow {
  obraId: string;
  obraName: string;
  client: string;
  contractNumber: string;
  equipmentsUsed: string[];
  totalFuelLiters: number;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalDowntimeHours: number;
  totalDowntimeCost: number;
  totalCost: number;
}

export interface ExecutiveEquipmentRankingRow {
  equipmentId: string;
  equipmentName: string;
  obraName: string;
  fuelCost: number;
  maintenanceCost: number;
  downtimeHours: number;
  downtimeCost: number;
  totalCost: number;
  costPerHour: number | null;
  costPerKm: number | null;
  availability: number;
}

export interface ExecutiveProfessionalReport {
  totalCost: number;
  totalFuelLiters: number;
  averageAvailability: number;
  ranking: ExecutiveEquipmentRankingRow[];
}

type FuelRecordLike = {
  target_equipment_id?: string | null;
  fuel_type?: string | null;
  liters?: number | string | null;
  hour_meter?: number | string | null;
};

const normalize = (value?: string | null) => String(value || "").trim().toLowerCase();

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value || 0);
}

export function formatPartsLabel(parts: unknown, partCode?: string | null) {
  const list = Array.isArray(parts) ? parts as Array<{ code?: string; description?: string }> : [];
  if (list.length > 0) {
    return list
      .map((item) => [item.code, item.description ? `(${item.description})` : ""].filter(Boolean).join(" "))
      .join(", ");
  }
  return partCode || "—";
}

export function getDowntimeHours(order: Pick<DBWorkOrder, "started_at" | "completed_at" | "created_at">) {
  const start = order.started_at ? new Date(order.started_at).getTime() : new Date(order.created_at).getTime();
  const end = order.completed_at ? new Date(order.completed_at).getTime() : Date.now();
  const diff = (end - start) / (1000 * 60 * 60);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

export function buildFuelPriceMap(settings: DBFuelPriceSetting[]) {
  return Object.fromEntries(settings.map((item) => [normalize(item.fuel_type), Number(item.unit_price || 0)]));
}

export function buildMaintenanceEquipmentRows(
  equipments: DBEquipment[],
  obras: DBObra[],
  workOrders: WorkOrderFinancialLike[],
  maintenanceHistory: DBMaintenanceHistory[],
  selectedEquipmentId?: string,
) {
  const obraMap = Object.fromEntries(obras.map((obra) => [obra.id, obra.name]));
  const allowed = new Set(
    (selectedEquipmentId ? equipments.filter((item) => item.id === selectedEquipmentId) : equipments)
      .map((item) => item.id),
  );

  const historyRows: MaintenanceEquipmentReportRow[] = maintenanceHistory
    .filter((item) => allowed.has(item.equipment_id))
    .map((item) => {
      const equipment = equipments.find((eq) => eq.id === item.equipment_id);
      const partsCost = Number(item.parts_cost || 0);
      const laborCost = Number(item.labor_cost || 0);
      return {
        equipmentId: item.equipment_id,
        equipmentName: equipment ? getEquipmentDisplayName(equipment) : "Equipamento removido",
        obraName: obraMap[equipment?.obra_id || ""] || "Sem obra",
        date: item.executed_at,
        source: "Histórico",
        description: item.description,
        parts: item.notes || "—",
        partsCost,
        laborCost,
        totalCost: partsCost + laborCost,
        status: "Executado",
      };
    });

  const orderRows: MaintenanceEquipmentReportRow[] = workOrders
    .filter((item) => allowed.has(item.equipment_id))
    .map((item) => {
      const equipment = equipments.find((eq) => eq.id === item.equipment_id);
      const partsCost = Number(item.parts_cost || 0);
      const laborCost = Number(item.labor_cost || 0);
      return {
        equipmentId: item.equipment_id,
        equipmentName: equipment ? getEquipmentDisplayName(equipment) : "Equipamento removido",
        obraName: obraMap[equipment?.obra_id || ""] || "Sem obra",
        date: item.completed_at || item.started_at || item.created_at,
        source: "OS",
        description: `OS #${item.os_number} — ${item.description}`,
        parts: formatPartsLabel(item.parts, item.part_code),
        partsCost,
        laborCost,
        totalCost: partsCost + laborCost,
        status: item.status,
      };
    });

  return [...historyRows, ...orderRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function buildExecutiveEquipmentRanking(
  equipments: DBEquipment[],
  obras: DBObra[],
  fuelRecords: FuelRecordLike[],
  workOrders: WorkOrderFinancialLike[],
  maintenanceHistory: DBMaintenanceHistory[],
  fuelPriceSettings: DBFuelPriceSetting[],
) {
  const obraMap = Object.fromEntries(obras.map((obra) => [obra.id, obra.name]));
  const priceMap = buildFuelPriceMap(fuelPriceSettings);

  return equipments
    .filter((equipment) => equipment.type !== "combo")
    .map((equipment) => {
      const relatedFuel = fuelRecords.filter((record) => record.target_equipment_id === equipment.id);
      const fuelCost = relatedFuel.reduce((sum, record) => {
        const liters = Number(record.liters || 0);
        const price = priceMap[normalize(record.fuel_type) || "diesel"] || 0;
        return sum + liters * price;
      }, 0);

      const historyCost = maintenanceHistory
        .filter((item) => item.equipment_id === equipment.id)
        .reduce((sum, item) => sum + Number(item.parts_cost || 0) + Number(item.labor_cost || 0), 0);

      const orderCost = workOrders
        .filter((item) => item.equipment_id === equipment.id)
        .reduce((sum, item) => sum + Number(item.parts_cost || 0) + Number(item.labor_cost || 0), 0);

      const relatedOrders = workOrders.filter((item) => item.equipment_id === equipment.id);
      const downtimeHours = relatedOrders.reduce((sum, item) => sum + getDowntimeHours(item), 0);
      const downtimeCost = downtimeHours * Number((equipment as unknown as { cost_per_hour?: number }).cost_per_hour || 0);
      const totalCost = fuelCost + historyCost + orderCost + downtimeCost;

      const hourMeters = relatedFuel
        .map((item) => Number(item.hour_meter || 0))
        .filter((value) => value > 0)
        .sort((a, b) => a - b);
      const operatingBase = hourMeters.length >= 2 ? hourMeters[hourMeters.length - 1] - hourMeters[0] : Number(equipment.current_hour_meter || 0);
      const costPerHour = equipment.type === "truck" ? null : operatingBase > 0 ? totalCost / operatingBase : null;
      const costPerKm = equipment.type === "truck" ? (operatingBase > 0 ? totalCost / operatingBase : null) : null;

      const totalOrders = relatedOrders.length;
      const completedOrders = relatedOrders.filter((item) => item.status === "done").length;
      const availability = totalOrders === 0
        ? (equipment.status === "active" ? 100 : 80)
        : Math.max(0, Math.min(100, 100 - ((totalOrders - completedOrders) / totalOrders) * 100));

      return {
        equipmentId: equipment.id,
        equipmentName: getEquipmentDisplayName(equipment),
        obraName: obraMap[equipment.obra_id || ""] || "Sem obra",
        fuelCost,
        maintenanceCost: historyCost + orderCost,
        downtimeHours,
        downtimeCost,
        totalCost,
        costPerHour,
        costPerKm,
        availability,
      } satisfies ExecutiveEquipmentRankingRow;
    })
    .sort((a, b) => b.totalCost - a.totalCost);
}

export function buildObraProfessionalRows(
  equipments: DBEquipment[],
  obras: DBObra[],
  fuelRecords: FuelRecordLike[],
  workOrders: WorkOrderFinancialLike[],
  maintenanceHistory: DBMaintenanceHistory[],
  fuelPriceSettings: DBFuelPriceSetting[],
) {
  const priceMap = buildFuelPriceMap(fuelPriceSettings);
  const rows = obras.map((obra) => {
    const obraEquipments = equipments.filter((equipment) => equipment.obra_id === obra.id);
    const obraEquipmentIds = new Set(obraEquipments.map((item) => item.id));
    const obraFuel = fuelRecords.filter((record) => record.target_equipment_id && obraEquipmentIds.has(record.target_equipment_id));
    const obraOrders = workOrders.filter((item) => obraEquipmentIds.has(item.equipment_id));
    const obraHistory = maintenanceHistory.filter((item) => obraEquipmentIds.has(item.equipment_id));

    const totalFuelLiters = obraFuel.reduce((sum, item) => sum + Number(item.liters || 0), 0);
    const totalFuelCost = obraFuel.reduce((sum, item) => sum + Number(item.liters || 0) * (priceMap[normalize(item.fuel_type) || "diesel"] || 0), 0);
    const totalMaintenanceCost = obraOrders.reduce((sum, item) => sum + Number(item.parts_cost || 0) + Number(item.labor_cost || 0), 0)
      + obraHistory.reduce((sum, item) => sum + Number(item.parts_cost || 0) + Number(item.labor_cost || 0), 0);
    const totalDowntimeHours = obraOrders.reduce((sum, item) => sum + getDowntimeHours(item), 0);
    const totalDowntimeCost = obraOrders.reduce((sum, item) => {
      const equipment = obraEquipments.find((eq) => eq.id === item.equipment_id);
      return sum + getDowntimeHours(item) * Number((equipment as unknown as { cost_per_hour?: number }).cost_per_hour || 0);
    }, 0);

    return {
      obraId: obra.id,
      obraName: obra.name,
      client: obra.client || "—",
      contractNumber: obra.contract_number || "—",
      equipmentsUsed: obraEquipments.map((item) => item.name),
      totalFuelLiters,
      totalFuelCost,
      totalMaintenanceCost,
      totalDowntimeHours,
      totalDowntimeCost,
      totalCost: totalFuelCost + totalMaintenanceCost + totalDowntimeCost,
    } satisfies ObraProfessionalReportRow;
  });

  const unassigned = equipments.filter((equipment) => !equipment.obra_id);
  if (unassigned.length > 0) {
    const ids = new Set(unassigned.map((item) => item.id));
    const fuel = fuelRecords.filter((record) => record.target_equipment_id && ids.has(record.target_equipment_id));
    const orders = workOrders.filter((item) => ids.has(item.equipment_id));
    const history = maintenanceHistory.filter((item) => ids.has(item.equipment_id));
    rows.push({
      obraId: "unassigned",
      obraName: "Sem obra",
      client: "—",
      contractNumber: "—",
      equipmentsUsed: unassigned.map((item) => item.name),
      totalFuelLiters: fuel.reduce((sum, item) => sum + Number(item.liters || 0), 0),
      totalFuelCost: fuel.reduce((sum, item) => sum + Number(item.liters || 0) * (priceMap[normalize(item.fuel_type) || "diesel"] || 0), 0),
      totalMaintenanceCost: orders.reduce((sum, item) => sum + Number(item.parts_cost || 0) + Number(item.labor_cost || 0), 0)
        + history.reduce((sum, item) => sum + Number(item.parts_cost || 0) + Number(item.labor_cost || 0), 0),
      totalDowntimeHours: orders.reduce((sum, item) => sum + getDowntimeHours(item), 0),
      totalDowntimeCost: orders.reduce((sum, item) => {
        const equipment = unassigned.find((eq) => eq.id === item.equipment_id);
        return sum + getDowntimeHours(item) * Number((equipment as unknown as { cost_per_hour?: number }).cost_per_hour || 0);
      }, 0),
      totalCost: 0,
    });
    const last = rows[rows.length - 1];
    last.totalCost = last.totalFuelCost + last.totalMaintenanceCost + last.totalDowntimeCost;
  }

  return rows.sort((a, b) => b.totalCost - a.totalCost);
}

export function buildExecutiveProfessionalReport(
  equipments: DBEquipment[],
  obras: DBObra[],
  fuelRecords: FuelRecordLike[],
  workOrders: WorkOrderFinancialLike[],
  maintenanceHistory: DBMaintenanceHistory[],
  fuelPriceSettings: DBFuelPriceSetting[],
) {
  const ranking = buildExecutiveEquipmentRanking(equipments, obras, fuelRecords, workOrders, maintenanceHistory, fuelPriceSettings);
  return {
    totalCost: ranking.reduce((sum, item) => sum + item.totalCost, 0),
    totalFuelLiters: fuelRecords.reduce((sum, item) => sum + Number(item.liters || 0), 0),
    averageAvailability: ranking.length ? ranking.reduce((sum, item) => sum + item.availability, 0) / ranking.length : 100,
    ranking,
  } satisfies ExecutiveProfessionalReport;
}