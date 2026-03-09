-- Trigger para criar OS automaticamente quando um pedido de manutenção é criado
CREATE TRIGGER trg_auto_create_work_order
  AFTER INSERT ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_work_order();

-- Trigger para criar histórico e atualizar pedido quando OS é concluída
CREATE TRIGGER trg_auto_create_maintenance_history
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_maintenance_history();

-- Trigger para atualizar horímetro quando checklist é criado
CREATE TRIGGER trg_update_hour_meter_on_checklist
  AFTER INSERT ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hour_meter_on_checklist();

-- Trigger para atualizar combustível do comboio quando abastece equipamento
CREATE TRIGGER trg_update_combo_fuel_on_record
  AFTER INSERT ON public.fuel_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_combo_fuel_on_record();

-- Trigger para atualizar combustível do comboio quando recebe suprimento
CREATE TRIGGER trg_update_combo_fuel_on_supply
  AFTER INSERT ON public.fuel_supply_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_combo_fuel_on_supply();