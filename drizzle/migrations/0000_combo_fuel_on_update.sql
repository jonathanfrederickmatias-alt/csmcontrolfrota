-- Estoque dos comboios passa a ser recalculado também em UPDATE (troca de posto ou litros)
CREATE OR REPLACE FUNCTION public.update_combo_fuel_on_record()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.combo_equipment_id IS NOT DISTINCT FROM NEW.combo_equipment_id
       AND OLD.liters IS NOT DISTINCT FROM NEW.liters THEN
      RETURN NEW;
    END IF;
    IF OLD.combo_equipment_id IS NOT NULL THEN
      UPDATE public.equipments
      SET current_fuel = COALESCE(current_fuel, 0) + OLD.liters,
          updated_at = now()
      WHERE id = OLD.combo_equipment_id;
    END IF;
  END IF;
  IF NEW.combo_equipment_id IS NOT NULL AND NEW.liters > 0 THEN
    UPDATE public.equipments
    SET current_fuel = GREATEST(0, COALESCE(current_fuel, 0) - NEW.liters),
        updated_at = now()
    WHERE id = NEW.combo_equipment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_combo_fuel_on_record ON public.fuel_records;
CREATE TRIGGER trg_update_combo_fuel_on_record
AFTER INSERT OR UPDATE OF combo_equipment_id, liters ON public.fuel_records
FOR EACH ROW EXECUTE FUNCTION public.update_combo_fuel_on_record();