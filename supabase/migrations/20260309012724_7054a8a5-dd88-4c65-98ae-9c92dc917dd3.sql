
-- Fix: Recreate all triggers that were accidentally dropped in previous migration

-- 1. Trigger for auto-creating work orders from maintenance requests
CREATE OR REPLACE TRIGGER trg_auto_create_work_order
  AFTER INSERT ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_work_order();

-- 2. Trigger for syncing work order status to maintenance request (already exists, recreate to be safe)
DROP TRIGGER IF EXISTS trg_auto_create_maintenance_history ON public.work_orders;
CREATE TRIGGER trg_auto_create_maintenance_history
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_maintenance_history();

-- 3. Trigger for updating hour meter after checklist
CREATE OR REPLACE TRIGGER trg_update_hour_meter_on_checklist
  AFTER INSERT ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hour_meter_on_checklist();

-- 4. Trigger for updating combo fuel after fuel record (deduct)
CREATE OR REPLACE TRIGGER trg_update_combo_fuel_on_record
  AFTER INSERT ON public.fuel_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_combo_fuel_on_record();

-- 5. Trigger for updating combo fuel after supply (add)
CREATE OR REPLACE TRIGGER trg_update_combo_fuel_on_supply
  AFTER INSERT ON public.fuel_supply_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_combo_fuel_on_supply();

-- 6. Fix OS #8: sync maintenance request status
UPDATE public.maintenance_requests
SET status = 'open', resolved_at = NULL
WHERE id = '26c688ce-248d-49a7-8dc9-7f0ca88c83d5' AND status = 'done';
