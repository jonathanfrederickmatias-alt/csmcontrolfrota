-- Add items column to maintenance_requests for multi-item support
ALTER TABLE public.maintenance_requests 
ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Update auto_create_work_order to create one OS per item
CREATE OR REPLACE FUNCTION public.auto_create_work_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
BEGIN
  -- If items array has entries, create one OS per item
  IF NEW.items IS NOT NULL AND jsonb_array_length(NEW.items) > 0 THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      INSERT INTO public.work_orders (maintenance_request_id, equipment_id, description, priority)
      VALUES (
        NEW.id,
        NEW.equipment_id,
        COALESCE(item->>'description', NEW.description),
        COALESCE(item->>'priority', NEW.priority)
      );
    END LOOP;
  ELSE
    -- Backwards compatible: single OS for single-item requests
    INSERT INTO public.work_orders (maintenance_request_id, equipment_id, description, priority)
    VALUES (NEW.id, NEW.equipment_id, NEW.description, NEW.priority);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_create_work_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Update auto_create_maintenance_history to NOT auto-close the request (manual closure)
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
  -- When OS is completed: create history only (do NOT auto-close request)
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
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

    INSERT INTO public.maintenance_history (equipment_id, description, hour_meter, operator_name, notes, labor_cost, parts_cost)
    SELECT
      NEW.equipment_id,
      'OS #' || NEW.os_number || ' - ' || NEW.description,
      COALESCE(e.current_hour_meter, 0),
      COALESCE(NEW.mechanic_name, 'Mecânico'),
      'Peças: ' || parts_text,
      COALESCE(NEW.labor_cost, 0),
      COALESCE(NEW.parts_cost, 0)
    FROM public.equipments e
    WHERE e.id = NEW.equipment_id;

    -- Check if ALL OS for this request are done, if so update request to reflect progress
    -- But do NOT close: user closes manually
  END IF;

  -- When OS is reopened (from done to open/in_progress): reopen request
  IF OLD.status = 'done' AND NEW.status != 'done' THEN
    UPDATE public.maintenance_requests
    SET status = CASE WHEN NEW.status = 'in_progress' THEN 'in_progress' ELSE 'open' END,
        resolved_at = NULL
    WHERE id = NEW.maintenance_request_id AND status = 'done';
  END IF;

  -- When OS moves to in_progress: update request to in_progress (if still open)
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' AND OLD.status != 'done' THEN
    UPDATE public.maintenance_requests
    SET status = 'in_progress'
    WHERE id = NEW.maintenance_request_id AND status = 'open';
  END IF;

  RETURN NEW;
END;
$$;