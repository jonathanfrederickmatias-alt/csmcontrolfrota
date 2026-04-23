import { DBEquipment } from "@/lib/supabase-types";

type EquipmentDisplayInput = Omit<Pick<DBEquipment, "type" | "name" | "plate" | "chassis" | "cost_center">, "type"> & {
  type?: DBEquipment["type"] | string | null;
};

function cleanValue(value?: string | null) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export function getEquipmentIdentifierLabel(equipment?: Partial<EquipmentDisplayInput> | null) {
  if (!equipment) return "Identificação";
  if (equipment.type === "truck") return "Placa";
  if (equipment.type === "machine") return "Série";
  if (equipment.type === "combo") return "Placa";
  return "Identificação";
}

export function getEquipmentIdentifier(equipment?: Partial<EquipmentDisplayInput> | null) {
  if (!equipment) return null;

  const plate = cleanValue(equipment.plate);
  const chassis = cleanValue(equipment.chassis);
  const costCenter = cleanValue(equipment.cost_center);

  if (equipment.type === "machine") return chassis || plate || costCenter;
  if (equipment.type === "truck") return plate || chassis || costCenter;
  if (equipment.type === "combo") return plate || chassis || costCenter;

  return chassis || plate || costCenter;
}

export function getEquipmentDisplayName(equipment?: Partial<EquipmentDisplayInput> | null) {
  if (!equipment) return "Equipamento sem identificação";
  const baseName = cleanValue(equipment.name) || "Equipamento sem identificação";
  const identifier = getEquipmentIdentifier(equipment);
  return identifier ? `${baseName} (${identifier})` : baseName;
}