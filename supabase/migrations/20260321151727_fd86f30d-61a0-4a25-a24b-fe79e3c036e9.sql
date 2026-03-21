
-- Add hour_meter column to fuel_records
ALTER TABLE public.fuel_records ADD COLUMN hour_meter numeric NULL;

-- Create trigger to update equipment hour_meter on fuel record insert
CREATE OR REPLACE FUNCTION public.update_hour_meter_on_fuel_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.hour_meter IS NOT NULL AND NEW.hour_meter > 0 THEN
    UPDATE public.equipments
    SET current_hour_meter = GREATEST(current_hour_meter, NEW.hour_meter),
        updated_at = now()
    WHERE id = NEW.target_equipment_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_hour_meter_on_fuel_insert
AFTER INSERT ON public.fuel_records
FOR EACH ROW
EXECUTE FUNCTION public.update_hour_meter_on_fuel_record();
