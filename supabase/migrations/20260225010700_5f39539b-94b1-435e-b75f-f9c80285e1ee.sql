
-- Update trigger to include parts list in maintenance history notes
CREATE OR REPLACE FUNCTION public.auto_create_maintenance_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parts_text text := '';
  part_record jsonb;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    -- Build parts text from JSON array
    IF NEW.parts IS NOT NULL AND jsonb_array_length(NEW.parts) > 0 THEN
      FOR part_record IN SELECT * FROM jsonb_array_elements(NEW.parts)
      LOOP
        IF parts_text != '' THEN parts_text := parts_text || ', '; END IF;
        parts_text := parts_text || COALESCE(part_record->>'code', '');
        IF (part_record->>'description') IS NOT NULL AND (part_record->>'description') != '' THEN
          parts_text := parts_text || ' (' || (part_record->>'description') || ')';
        END IF;
      END LOOP;
    ELSE
      parts_text := COALESCE(NEW.part_code, 'N/A');
    END IF;

    INSERT INTO public.maintenance_history (equipment_id, description, hour_meter, operator_name, notes)
    SELECT
      NEW.equipment_id,
      'OS #' || NEW.os_number || ' - ' || NEW.description,
      COALESCE(e.current_hour_meter, 0),
      COALESCE(NEW.mechanic_name, 'Mecânico'),
      'Peças: ' || parts_text
    FROM public.equipments e
    WHERE e.id = NEW.equipment_id;

    UPDATE public.maintenance_requests
    SET status = 'done', resolved_at = now()
    WHERE id = NEW.maintenance_request_id;
  END IF;
  RETURN NEW;
END;
$$;
