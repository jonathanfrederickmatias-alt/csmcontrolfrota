export interface Equipment {
  id: string;
  name: string;
  type: 'machine' | 'truck' | 'combo';
  plate?: string;
  model?: string;
  currentHourMeter: number;
  fuelCapacity?: number;
  currentFuel?: number;
  status: 'active' | 'maintenance' | 'inactive';
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  observation?: string;
}

export interface Checklist {
  id: string;
  equipmentId: string;
  operatorName: string;
  hourMeter: number;
  date: string;
  items: ChecklistItem[];
  status: 'ok' | 'attention' | 'critical';
  createdAt: string;
}

export interface MaintenancePlan {
  id: string;
  equipmentId: string;
  description: string;
  intervalHours: number;
  lastDoneAt: number; // hour meter when last done
  nextDueAt: number;  // hour meter when next due
  status: 'ok' | 'approaching' | 'overdue';
  createdAt: string;
}

export interface FuelRecord {
  id: string;
  comboEquipmentId: string;
  targetEquipmentId: string;
  liters: number;
  date: string;
  operatorName: string;
  createdAt: string;
}

export interface MaintenanceRequest {
  id: string;
  equipmentId: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'done';
  operatorName: string;
  createdAt: string;
}
