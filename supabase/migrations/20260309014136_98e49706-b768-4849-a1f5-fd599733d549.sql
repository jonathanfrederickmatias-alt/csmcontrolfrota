-- Ensure trigger exists for auto-creating work orders
DROP TRIGGER IF EXISTS trg_auto_create_work_order ON public.maintenance_requests;

CREATE TRIGGER trg_auto_create_work_order
  AFTER INSERT ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_work_order();

-- Also ensure the trigger for syncing work_order status exists
DROP TRIGGER IF EXISTS trg_auto_create_maintenance_history ON public.work_orders;

CREATE TRIGGER trg_auto_create_maintenance_history
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_maintenance_history();

-- Recreate other triggers
DROP TRIGGER IF EXISTS trg_update_hour_meter_on_checklist ON public.checklists;
CREATE TRIGGER trg_update_hour_meter_on_checklist
  AFTER INSERT ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hour_meter_on_checklist();

DROP TRIGGER IF EXISTS trg_update_combo_fuel_on_record ON public.fuel_records;
CREATE TRIGGER trg_update_combo_fuel_on_record
  AFTER INSERT ON public.fuel_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_combo_fuel_on_record();

DROP TRIGGER IF EXISTS trg_update_combo_fuel_on_supply ON public.fuel_supply_records;
CREATE TRIGGER trg_update_combo_fuel_on_supply
  AFTER INSERT ON public.fuel_supply_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_combo_fuel_on_supply();