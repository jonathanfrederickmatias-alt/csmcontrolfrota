-- Recreate ALL essential triggers
CREATE OR REPLACE TRIGGER trg_auto_create_work_order
  AFTER INSERT ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_work_order();

CREATE OR REPLACE TRIGGER trg_auto_create_maintenance_history
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_maintenance_history();

CREATE OR REPLACE TRIGGER trg_update_hour_meter_on_checklist
  AFTER INSERT ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hour_meter_on_checklist();

CREATE OR REPLACE TRIGGER trg_update_combo_fuel_on_record
  AFTER INSERT ON public.fuel_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_combo_fuel_on_record();

CREATE OR REPLACE TRIGGER trg_update_combo_fuel_on_supply
  AFTER INSERT ON public.fuel_supply_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_combo_fuel_on_supply();