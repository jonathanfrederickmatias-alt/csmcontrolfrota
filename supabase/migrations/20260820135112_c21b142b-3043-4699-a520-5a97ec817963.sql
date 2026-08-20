DO $$
DECLARE old_id uuid := 'df479bd7-0266-4f02-8921-1c7f16f7e922';
        new_id uuid := 'adc05918-1065-4d25-b98b-62f0477acbb3';
BEGIN
  INSERT INTO public.equipments (id, name, type, plate, model, current_hour_meter, fuel_capacity, current_fuel, status, created_at, updated_at, obra_id, brand, cost_center, year, ownership, chassis, cost_per_hour, tenant_id, track_hour_meter)
  SELECT old_id, name, type, plate, model, current_hour_meter, fuel_capacity, current_fuel, status, created_at, updated_at, obra_id, brand, cost_center, year, ownership, chassis, cost_per_hour, tenant_id, track_hour_meter
  FROM public.equipments WHERE id = new_id;

  UPDATE public.checklists SET equipment_id = old_id WHERE equipment_id = new_id;
  UPDATE public.fuel_records SET target_equipment_id = old_id WHERE target_equipment_id = new_id;
  UPDATE public.fuel_records SET combo_equipment_id = old_id WHERE combo_equipment_id = new_id;
  UPDATE public.fuel_supply_records SET combo_equipment_id = old_id WHERE combo_equipment_id = new_id;
  UPDATE public.maintenance_requests SET equipment_id = old_id WHERE equipment_id = new_id;
  UPDATE public.work_orders SET equipment_id = old_id WHERE equipment_id = new_id;
  UPDATE public.maintenance_plans SET equipment_id = old_id WHERE equipment_id = new_id;
  UPDATE public.maintenance_history SET equipment_id = old_id WHERE equipment_id = new_id;
  UPDATE public.equipment_documents SET equipment_id = old_id WHERE equipment_id = new_id;

  DELETE FROM public.equipments WHERE id = new_id;
END $$;