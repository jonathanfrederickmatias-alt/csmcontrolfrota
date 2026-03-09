-- Remove triggers duplicados (mantendo os que eu criei com prefixo trg_)
DROP TRIGGER IF EXISTS trigger_auto_create_work_order ON public.maintenance_requests;
DROP TRIGGER IF EXISTS trigger_auto_maintenance_history ON public.work_orders;
DROP TRIGGER IF EXISTS on_work_order_done ON public.work_orders;
DROP TRIGGER IF EXISTS update_hour_meter_after_checklist ON public.checklists;
DROP TRIGGER IF EXISTS update_combo_fuel_after_fuel_record ON public.fuel_records;
DROP TRIGGER IF EXISTS update_combo_fuel_after_supply ON public.fuel_supply_records;

-- Limpar a OS duplicada de teste
DELETE FROM work_orders WHERE id = '1ad5b9ca-9198-4a26-9953-29407d610100';