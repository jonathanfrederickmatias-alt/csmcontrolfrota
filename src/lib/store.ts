import { Equipment, Checklist, MaintenancePlan, FuelRecord, MaintenanceRequest } from './types';

function getItem<T>(key: string, fallback: T[]): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch { return fallback; }
}

function setItem<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export const store = {
  // Equipment
  getEquipments: (): Equipment[] => getItem('equipments', []),
  saveEquipment: (eq: Equipment) => {
    const list = store.getEquipments().filter(e => e.id !== eq.id);
    list.push(eq);
    setItem('equipments', list);
  },
  deleteEquipment: (id: string) => {
    setItem('equipments', store.getEquipments().filter(e => e.id !== id));
  },

  // Checklists
  getChecklists: (): Checklist[] => getItem('checklists', []),
  saveChecklist: (cl: Checklist) => {
    const list = store.getChecklists().filter(c => c.id !== cl.id);
    list.push(cl);
    setItem('checklists', list);
    // Update equipment hour meter
    const eq = store.getEquipments().find(e => e.id === cl.equipmentId);
    if (eq && cl.hourMeter > eq.currentHourMeter) {
      eq.currentHourMeter = cl.hourMeter;
      store.saveEquipment(eq);
      store.updateMaintenanceStatuses(cl.equipmentId, cl.hourMeter);
    }
  },

  // Maintenance Plans
  getMaintenancePlans: (): MaintenancePlan[] => getItem('maintenancePlans', []),
  saveMaintenancePlan: (mp: MaintenancePlan) => {
    const list = store.getMaintenancePlans().filter(m => m.id !== mp.id);
    list.push(mp);
    setItem('maintenancePlans', list);
  },
  deleteMaintenancePlan: (id: string) => {
    setItem('maintenancePlans', store.getMaintenancePlans().filter(m => m.id !== id));
  },
  updateMaintenanceStatuses: (equipmentId: string, currentHourMeter: number) => {
    const plans = store.getMaintenancePlans();
    const updated = plans.map(p => {
      if (p.equipmentId !== equipmentId) return p;
      const remaining = p.nextDueAt - currentHourMeter;
      let status: MaintenancePlan['status'] = 'ok';
      if (remaining <= 0) status = 'overdue';
      else if (remaining <= 50) status = 'approaching'; // 50h default for local store
      return { ...p, status };
    });
    setItem('maintenancePlans', updated);
  },

  // Fuel Records
  getFuelRecords: (): FuelRecord[] => getItem('fuelRecords', []),
  saveFuelRecord: (fr: FuelRecord) => {
    const list = store.getFuelRecords();
    list.push(fr);
    setItem('fuelRecords', list);
    // Update combo fuel (subtract)
    const combo = store.getEquipments().find(e => e.id === fr.comboEquipmentId);
    if (combo && combo.currentFuel !== undefined) {
      combo.currentFuel = Math.max(0, combo.currentFuel - fr.liters);
      store.saveEquipment(combo);
    }
  },

  // Maintenance Requests
  getMaintenanceRequests: (): MaintenanceRequest[] => getItem('maintenanceRequests', []),
  saveMaintenanceRequest: (mr: MaintenanceRequest) => {
    const list = store.getMaintenanceRequests().filter(m => m.id !== mr.id);
    list.push(mr);
    setItem('maintenanceRequests', list);
  },
};

export function generateId() {
  return crypto.randomUUID();
}
