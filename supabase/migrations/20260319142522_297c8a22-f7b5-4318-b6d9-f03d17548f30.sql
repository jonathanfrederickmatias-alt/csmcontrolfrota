
ALTER TABLE public.insurance_records 
  ADD COLUMN equipment_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.insurance_records 
  SET equipment_ids = jsonb_build_array(equipment_id::text)
  WHERE equipment_id IS NOT NULL;

ALTER TABLE public.insurance_records 
  DROP COLUMN equipment_id;
