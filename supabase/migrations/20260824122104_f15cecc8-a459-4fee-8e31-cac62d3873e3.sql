CREATE OR REPLACE FUNCTION public.recalc_equipment_release_status(_equipment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  has_urgent boolean;
BEGIN
  IF _equipment_id IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.equipment_id = _equipment_id
      AND wo.status IN ('open', 'in_progress')
      AND lower(wo.priority) = 'urgent'
  ) INTO has_urgent;

  UPDATE public.equipments e
  SET status = CASE WHEN has_urgent THEN 'maintenance' ELSE 'active' END,
      updated_at = now()
  WHERE e.id = _equipment_id
    AND e.status <> 'inactive'
    AND e.status IS DISTINCT FROM (CASE WHEN has_urgent THEN 'maintenance' ELSE 'active' END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_equipment_release_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_equipment_release_status(OLD.equipment_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalc_equipment_release_status(NEW.equipment_id);
  IF TG_OP = 'UPDATE' AND OLD.equipment_id IS DISTINCT FROM NEW.equipment_id THEN
    PERFORM public.recalc_equipment_release_status(OLD.equipment_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_equipment_release_status ON public.work_orders;
CREATE TRIGGER trg_sync_equipment_release_status
AFTER INSERT OR UPDATE OF status, priority, equipment_id OR DELETE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_equipment_release_status();

-- auto_create_maintenance_history no longer decides release status manually
CREATE OR REPLACE FUNCTION public.auto_create_maintenance_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parts_text text := '';
  part_record jsonb;
  effective_meter numeric := 0;
  effective_completed_at timestamptz;
BEGIN
  effective_meter := GREATEST(COALESCE(NEW.execution_meter, 0), 0);
  effective_completed_at := COALESCE(NEW.completed_at, now());

  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    IF NEW.parts IS NOT NULL AND jsonb_array_length(NEW.parts) > 0 THEN
      FOR part_record IN SELECT * FROM jsonb_array_elements(NEW.parts)
      LOOP
        IF parts_text != '' THEN parts_text := parts_text || ', '; END IF;
        parts_text := parts_text || COALESCE(part_record->>'code', '');
        IF COALESCE(part_record->>'description', '') != '' THEN
          parts_text := parts_text || ' (' || (part_record->>'description') || ')';
        END IF;
        IF COALESCE(part_record->>'quantity', '') != '' THEN
          parts_text := parts_text || ' x' || (part_record->>'quantity');
        END IF;
      END LOOP;
    ELSE
      parts_text := COALESCE(NEW.part_code, 'N/A');
    END IF;

    UPDATE public.equipments e
    SET current_hour_meter = GREATEST(e.current_hour_meter, effective_meter),
        updated_at = now()
    WHERE e.id = NEW.equipment_id;

    INSERT INTO public.maintenance_history (
      equipment_id,
      plan_id,
      description,
      hour_meter,
      executed_at,
      operator_name,
      notes,
      labor_cost,
      parts_cost
    )
    VALUES (
      NEW.equipment_id,
      NEW.maintenance_plan_id,
      COALESCE(NEW.service_executed, NEW.description),
      effective_meter,
      effective_completed_at,
      NEW.mechanic_name,
      NULLIF(concat_ws(E'\n',
        NULLIF(NEW.technical_observations, ''),
        NULLIF(NEW.notes, ''),
        CASE WHEN parts_text <> '' AND parts_text <> 'N/A' THEN 'Peças: ' || parts_text ELSE NULL END
      ), ''),
      NEW.labor_cost,
      NEW.parts_cost
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Recalcula todos os equipamentos com a nova regra
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.equipments WHERE status <> 'inactive' LOOP
    PERFORM public.recalc_equipment_release_status(r.id);
  END LOOP;
END $$;