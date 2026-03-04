// Helper types matching DB schema
export interface DBEquipment {
  id: string;
  name: string;
  type: 'machine' | 'truck' | 'combo';
  plate?: string;
  model?: string;
  brand?: string;
  cost_center?: string;
  current_hour_meter: number;
  fuel_capacity?: number;
  current_fuel?: number;
  status: 'active' | 'maintenance' | 'inactive';
  obra_id?: string;
  year?: number;
  created_at: string;
  updated_at: string;
}

export interface DBObra {
  id: string;
  name: string;
  location?: string;
  contract_number?: string;
  client?: string;
  cnpj?: string;
  start_date?: string;
  expected_end_date?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface DBMaintenanceHistory {
  id: string;
  equipment_id: string;
  plan_id?: string;
  description: string;
  hour_meter: number;
  executed_at: string;
  notes?: string;
  operator_name?: string;
  created_at: string;
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
  type: 'daily' | 'corrective' | 'preventive';
  photo_url?: string;
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

export interface DBWorkOrder {
  id: string;
  os_number: number;
  maintenance_request_id: string;
  equipment_id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  mechanic_name?: string;
  status: 'open' | 'in_progress' | 'done';
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}
