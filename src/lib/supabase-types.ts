// Helper types matching DB schema
export interface DBEquipment {
  id: string;
  name: string;
  type: 'machine' | 'truck' | 'combo';
  plate?: string;
  model?: string;
  current_hour_meter: number;
  fuel_capacity?: number;
  current_fuel?: number;
  status: 'active' | 'maintenance' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface DBMaintenancePlan {
  id: string;
  equipment_id: string;
  description: string;
  interval_hours: number;
  last_done_at: number;
  next_due_at: number;
  status: 'ok' | 'approaching' | 'overdue';
  last_executed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DBMaintenanceRequest {
  id: string;
  equipment_id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'done';
  operator_name: string;
  notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DBChecklist {
  id: string;
  equipment_id: string;
  operator_name: string;
  hour_meter: number;
  date: string;
  status: 'ok' | 'attention' | 'critical';
  items: ChecklistItemDB[];
  created_at: string;
}

export interface ChecklistItemDB {
  id: string;
  label: string;
  checked: boolean;
  observation?: string;
}

export interface DBFuelRecord {
  id: string;
  combo_equipment_id: string;
  target_equipment_id: string;
  liters: number;
  date: string;
  operator_name: string;
  created_at: string;
}

export interface DBFuelSupplyRecord {
  id: string;
  combo_equipment_id: string;
  liters: number;
  invoice_number?: string;
  supplier?: string;
  date: string;
  notes?: string;
  responsible_name: string;
  created_at: string;
}
