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
  chassis?: string;
  ownership: 'own' | 'third_party';
  tenant_id?: string;
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
  parts_cost?: number;
  labor_cost?: number;
  costs_validated?: boolean;
  costs_validated_at?: string | null;
  costs_validated_by?: string | null;
  created_at: string;
}

export interface DBMaintenancePlan {
  id: string;
  equipment_id: string;
  description: string;
  plan_type?: 'km' | 'horimetro' | 'tempo';
  interval_hours: number | null;
  last_done_at: number | null;
  next_due_at: number | null;
  interval_days?: number | null;
  last_done_date?: string | null;
  next_due_date?: string | null;
  status: 'ok' | 'approaching' | 'overdue';
  last_executed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRequestItem {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
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
  items: MaintenanceRequestItem[];
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
  na?: boolean;
  observation?: string;
}

export interface DBFuelRecord {
  id: string;
  combo_equipment_id: string;
  target_equipment_id: string;
  liters: number;
  date: string;
  operator_name: string;
  photo_url?: string;
  hour_meter?: number;
  created_at: string;
}

export interface FuelSupplyExtraItem {
  name: string;
  quantity: string;
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
  extra_items?: FuelSupplyExtraItem[];
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
  maintenance_type?: string | null;
  part_code?: string | null;
  invoice_number?: string | null;
  service_executed?: string | null;
  cause_identified?: string | null;
  technical_observations?: string | null;
  labor_cost?: number | null;
  parts_cost?: number | null;
  execution_meter?: number | null;
  machine_released?: boolean | null;
  final_status?: string | null;
  maintenance_plan_id?: string | null;
  parts?: any;
  photo_start_url?: string | null;
  photo_end_url?: string | null;
}
