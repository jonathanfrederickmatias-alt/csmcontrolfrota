
-- ===== CSMCONTROL DATABASE SCHEMA =====

-- 1. EQUIPMENTS
CREATE TABLE public.equipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('machine', 'truck', 'combo')),
  plate TEXT,
  model TEXT,
  current_hour_meter NUMERIC NOT NULL DEFAULT 0,
  fuel_capacity NUMERIC,
  current_fuel NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. MAINTENANCE PLANS
CREATE TABLE public.maintenance_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  interval_hours NUMERIC NOT NULL,
  last_done_at NUMERIC NOT NULL DEFAULT 0,
  next_due_at NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'approaching', 'overdue')),
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. MAINTENANCE REQUESTS
CREATE TABLE public.maintenance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  operator_name TEXT NOT NULL,
  notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. CHECKLISTS
CREATE TABLE public.checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  operator_name TEXT NOT NULL,
  hour_meter NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'attention', 'critical')),
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. FUEL RECORDS (abastecimento das máquinas a partir do comboio)
CREATE TABLE public.fuel_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  target_equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  liters NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  operator_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. FUEL SUPPLY RECORDS (reabastecimento do comboio - entrada de combustível)
CREATE TABLE public.fuel_supply_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  liters NUMERIC NOT NULL,
  invoice_number TEXT,
  supplier TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  responsible_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ===== ROW LEVEL SECURITY =====
-- This is a single-tenant system (all gestores share data), so RLS is open for authenticated users

ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_supply_records ENABLE ROW LEVEL SECURITY;

-- Authenticated gestores can do everything
CREATE POLICY "Authenticated users can manage equipments" ON public.equipments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage maintenance_plans" ON public.maintenance_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage maintenance_requests" ON public.maintenance_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage checklists" ON public.checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage fuel_records" ON public.fuel_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage fuel_supply_records" ON public.fuel_supply_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public (anonymous) can INSERT only - for QR Code operations by operators
CREATE POLICY "Public can insert checklists" ON public.checklists FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public can insert maintenance_requests" ON public.maintenance_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public can read equipments" ON public.equipments FOR SELECT TO anon USING (true);
CREATE POLICY "Public can insert fuel_records" ON public.fuel_records FOR INSERT TO anon WITH CHECK (true);

-- ===== TRIGGERS FOR UPDATED_AT =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_equipments_updated_at BEFORE UPDATE ON public.equipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_maintenance_plans_updated_at BEFORE UPDATE ON public.maintenance_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_maintenance_requests_updated_at BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== TRIGGER: Update combo fuel when fuel record inserted =====
CREATE OR REPLACE FUNCTION public.update_combo_fuel_on_record()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.equipments
  SET current_fuel = GREATEST(0, COALESCE(current_fuel, 0) - NEW.liters),
      updated_at = now()
  WHERE id = NEW.combo_equipment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_combo_fuel_after_fuel_record
AFTER INSERT ON public.fuel_records
FOR EACH ROW EXECUTE FUNCTION public.update_combo_fuel_on_record();

-- ===== TRIGGER: Update combo fuel when supply record inserted (ADD fuel) =====
CREATE OR REPLACE FUNCTION public.update_combo_fuel_on_supply()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.equipments
  SET current_fuel = LEAST(COALESCE(fuel_capacity, 999999), COALESCE(current_fuel, 0) + NEW.liters),
      updated_at = now()
  WHERE id = NEW.combo_equipment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_combo_fuel_after_supply
AFTER INSERT ON public.fuel_supply_records
FOR EACH ROW EXECUTE FUNCTION public.update_combo_fuel_on_supply();

-- ===== TRIGGER: Update equipment hour meter from checklist =====
CREATE OR REPLACE FUNCTION public.update_hour_meter_on_checklist()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.equipments
  SET current_hour_meter = GREATEST(current_hour_meter, NEW.hour_meter),
      updated_at = now()
  WHERE id = NEW.equipment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_hour_meter_after_checklist
AFTER INSERT ON public.checklists
FOR EACH ROW EXECUTE FUNCTION public.update_hour_meter_on_checklist();
